import test from 'node:test';
import assert from 'node:assert/strict';
import { createCsrfFetch, readCsrfToken } from '../src/lib/api/csrf-client';

const ORIGIN = 'http://localhost:3000';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
}

type Responder = (call: Call, callNumber: number) => Response;

function makeEnv(opts: { initialCookie?: string; responder?: Responder } = {}) {
  const calls: Call[] = [];
  let cookie = opts.initialCookie ?? '';
  let issued = 0;
  const responder: Responder =
    opts.responder ?? (() => new Response(JSON.stringify({ ok: true }), { status: 200 }));

  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = typeof Request !== 'undefined' && input instanceof Request ? input : null;
    const url = req ? req.url : input instanceof URL ? input.href : String(input);
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    const headers = Object.fromEntries(new Headers(init?.headers ?? req?.headers).entries());
    const call = { url, method, headers };
    calls.push(call);
    if (url.endsWith('/api/auth/csrf')) {
      issued += 1;
      cookie = `csrf_token=tok${issued}`;
      return new Response(JSON.stringify({ csrfToken: `tok${issued}` }), { status: 200 });
    }
    return responder(call, calls.length);
  };

  return {
    calls,
    csrfCalls: () => calls.filter((c) => c.url.endsWith('/api/auth/csrf')).length,
    fetch: createCsrfFetch({ fetch: fakeFetch as typeof fetch, getCookie: () => cookie, origin: ORIGIN }),
  };
}

const invalidCsrf = () =>
  new Response(JSON.stringify({ error: 'Invalid CSRF token' }), { status: 403 });

test('readCsrfToken finds the cookie among others and handles absence', () => {
  assert.equal(readCsrfToken('a=1; csrf_token=abc123; b=2'), 'abc123');
  assert.equal(readCsrfToken('a=1; b=2'), null);
  assert.equal(readCsrfToken(''), null);
  assert.equal(readCsrfToken('csrf_token=a%20b'), 'a b');
});

test('safe methods pass through untouched (no header, no token request)', async () => {
  const env = makeEnv();
  await env.fetch('/api/student/twin');
  assert.equal(env.calls.length, 1);
  assert.equal(env.calls[0].headers['x-csrf-token'], undefined);
});

test('POST with a cookie present gets the matching header', async () => {
  const env = makeEnv({ initialCookie: 'csrf_token=abc' });
  await env.fetch('/api/faculty/courses', { method: 'POST', body: '{}' });
  assert.equal(env.calls.length, 1);
  assert.equal(env.calls[0].headers['x-csrf-token'], 'abc');
  assert.equal(env.csrfCalls(), 0);
});

test('missing cookie triggers one token fetch, then the request carries it', async () => {
  const env = makeEnv();
  await env.fetch('/api/auth/logout', { method: 'POST' });
  assert.deepEqual(
    env.calls.map((c) => `${c.method} ${c.url}`),
    ['GET /api/auth/csrf', 'POST /api/auth/logout']
  );
  assert.equal(env.calls[1].headers['x-csrf-token'], 'tok1');
});

test('concurrent mutating requests share a single token refresh', async () => {
  const env = makeEnv();
  await Promise.all([
    env.fetch('/api/a', { method: 'POST' }),
    env.fetch('/api/b', { method: 'PATCH' }),
    env.fetch('/api/c', { method: 'DELETE' }),
  ]);
  assert.equal(env.csrfCalls(), 1);
  const mutating = env.calls.filter((c) => !c.url.endsWith('/api/auth/csrf'));
  assert.equal(mutating.length, 3);
  assert.ok(mutating.every((c) => c.headers['x-csrf-token'] === 'tok1'));
});

test('DELETE, PATCH and PUT are covered, not just POST', async () => {
  const env = makeEnv({ initialCookie: 'csrf_token=abc' });
  for (const method of ['DELETE', 'PATCH', 'PUT']) {
    await env.fetch('/api/x', { method });
  }
  assert.ok(env.calls.every((c) => c.headers['x-csrf-token'] === 'abc'));
});

test('the token is never sent cross-origin or to non-API paths', async () => {
  const env = makeEnv({ initialCookie: 'csrf_token=abc' });
  await env.fetch('https://example.com/api/steal', { method: 'POST' });
  await env.fetch('/login', { method: 'POST' });
  assert.equal(env.calls.length, 2);
  assert.ok(env.calls.every((c) => c.headers['x-csrf-token'] === undefined));
});

test('existing headers are preserved when the token is added', async () => {
  const env = makeEnv({ initialCookie: 'csrf_token=abc' });
  await env.fetch('/api/x', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  assert.equal(env.calls[0].headers['content-type'], 'application/json');
  assert.equal(env.calls[0].headers['x-csrf-token'], 'abc');
});

test('a Request object input is handled', async () => {
  const env = makeEnv({ initialCookie: 'csrf_token=abc' });
  await env.fetch(new Request(`${ORIGIN}/api/faculty/courses/1`, { method: 'DELETE' }));
  assert.equal(env.calls[0].method, 'DELETE');
  assert.equal(env.calls[0].headers['x-csrf-token'], 'abc');
});

test('a stale token is refreshed and the request retried exactly once', async () => {
  const env = makeEnv({
    initialCookie: 'csrf_token=stale',
    responder: (call) => (call.headers['x-csrf-token'] === 'stale' ? invalidCsrf() : new Response('{}', { status: 200 })),
  });
  const res = await env.fetch('/api/x', { method: 'POST', body: '{}' });
  assert.equal(res.status, 200);
  assert.deepEqual(
    env.calls.map((c) => `${c.method} ${c.url} ${c.headers['x-csrf-token'] ?? ''}`.trim()),
    ['POST /api/x stale', 'GET /api/auth/csrf', 'POST /api/x tok1']
  );
});

test('a persistent CSRF rejection does not loop: one retry, then the 403 is returned', async () => {
  const env = makeEnv({ initialCookie: 'csrf_token=abc', responder: () => invalidCsrf() });
  const res = await env.fetch('/api/x', { method: 'POST', body: '{}' });
  assert.equal(res.status, 403);
  assert.equal(env.calls.length, 3); // POST, token refresh, POST
});

test('an unrelated 403 is NOT retried', async () => {
  const env = makeEnv({
    initialCookie: 'csrf_token=abc',
    responder: () => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
  });
  const res = await env.fetch('/api/x', { method: 'POST', body: '{}' });
  assert.equal(res.status, 403);
  assert.equal(env.calls.length, 1);
});

test('a streaming body is never retried (it cannot be replayed)', async () => {
  const env = makeEnv({ initialCookie: 'csrf_token=abc', responder: () => invalidCsrf() });
  const init = { method: 'POST', body: new ReadableStream() } as RequestInit;
  const res = await env.fetch('/api/x', init);
  assert.equal(res.status, 403);
  assert.equal(env.calls.length, 1);
});
