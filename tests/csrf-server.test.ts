import test from 'node:test';
import assert from 'node:assert/strict';
process.env.JWT_SECRET = 'test-secret-A-for-csrf-signing-0123456789';

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const cookieSets: Any[] = [];
function stub(path: string, exports: object) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports, children: [], paths: [], path: '' } as unknown as NodeJS.Module;
}
stub('next/headers', { cookies: () => ({ set: (...a: Any[]) => { cookieSets.push(a); } }) });
const { createSignedCsrfToken, generateCsrfToken, verifyCsrfToken } = require('../src/lib/auth/csrf') as Any;
const { readCsrfToken } = require('../src/lib/api/csrf-client') as Any;

const request = (cookie?: string, header?: string) => {
  const headers = new Headers();
  if (cookie !== undefined) headers.set('cookie', `csrf_token=${cookie}`);
  if (header !== undefined) headers.set('x-csrf-token', header);
  return new Request('http://localhost:3000/api/x', { method: 'POST', headers });
};

test('a server-issued token passes when cookie and header match', async () => {
  const t = await createSignedCsrfToken();
  assert.match(t, /^[0-9a-f]{64}\.[0-9a-f]{64}$/);
  assert.equal(await verifyCsrfToken(request(t, t)), true);
});

test('THE GAP: a made-up matching cookie+header pair is now REJECTED (it used to be accepted)', async () => {
  assert.equal(await verifyCsrfToken(request('attacker-chosen-value', 'attacker-chosen-value')), false);
  const fake = `${'a'.repeat(64)}.${'b'.repeat(64)}`;
  assert.equal(await verifyCsrfToken(request(fake, fake)), false);
});

test('mismatch, missing cookie, missing header and tampering are all rejected', async () => {
  const t = await createSignedCsrfToken(); const other = await createSignedCsrfToken();
  assert.equal(await verifyCsrfToken(request(t, other)), false);
  assert.equal(await verifyCsrfToken(request(undefined, t)), false);
  assert.equal(await verifyCsrfToken(request(t, undefined)), false);
  const tampered = t.slice(0, -2) + (t.endsWith('00') ? '11' : '00');
  assert.equal(await verifyCsrfToken(request(tampered, tampered)), false);
  const [random] = t.split('.');
  for (const bad of [random, `${random}.`, `.${t.split('.')[1]}`, `${t}.extra`]) assert.equal(await verifyCsrfToken(request(bad, bad)), false, bad);
});

test('a token signed with a DIFFERENT secret is rejected (and a missing secret fails closed)', async () => {
  const t = await createSignedCsrfToken();
  const saved = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'a-completely-different-secret-0123456789abcdef';
  assert.equal(await verifyCsrfToken(request(t, t)), false);
  delete process.env.JWT_SECRET;
  assert.equal(await verifyCsrfToken(request(t, t)), false);
  process.env.JWT_SECRET = saved;
  assert.equal(await verifyCsrfToken(request(t, t)), true);
});

test('CSRF_ENABLED=false still disables the check (existing behaviour)', async () => {
  process.env.CSRF_ENABLED = 'false';
  assert.equal(await verifyCsrfToken(request(undefined, undefined)), true);
  delete process.env.CSRF_ENABLED;
});

test('generateCsrfToken sets the same value in the cookie that verify accepts; the client reads it intact', async () => {
  const t = await generateCsrfToken();
  const [name, value] = cookieSets[cookieSets.length - 1];
  assert.equal(name, 'csrf_token'); assert.equal(value, t);
  assert.equal(await verifyCsrfToken(request(t, t)), true);
  assert.equal(readCsrfToken(`a=1; csrf_token=${t}; b=2`), t);
});
