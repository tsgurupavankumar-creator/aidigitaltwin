import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildResetEmail, resetLinkOrigin, sendPasswordResetEmail, smtpConfigFromEnv } from '../src/lib/email/password-reset';

const LINK = 'https://twin.example.edu/reset-password?token=abc';

function quiet<T>(fn: () => Promise<T>): Promise<{ result: T; logs: string[] }> {
  const logs: string[] = [];
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = (...a: unknown[]) => { logs.push(a.join(' ')); };
  return fn().then((result) => ({ result, logs })).finally(() => Object.assign(console, orig));
}

test('no SMTP in development: not delivered, link printed to the console', async () => {
  const { result, logs } = await quiet(() => sendPasswordResetEmail('a@x.co', LINK, { env: { NODE_ENV: 'development' } as unknown as NodeJS.ProcessEnv }));
  assert.deepEqual(result, { delivered: false, reason: 'smtp-not-configured' });
  assert.ok(logs.some((l) => l.includes(LINK)));
});

test('no SMTP in production: never logs the link', async () => {
  const { result, logs } = await quiet(() => sendPasswordResetEmail('a@x.co', LINK, { env: { NODE_ENV: 'production' } as unknown as NodeJS.ProcessEnv }));
  assert.equal(result.delivered, false);
  assert.ok(!logs.some((l) => l.includes('token=')));
});

test('SMTP configured: sends one email with from, to, subject and the link', async () => {
  const sent: Record<string, string>[] = [];
  const env = { SMTP_HOST: 'smtp.x', SMTP_PORT: '465', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_FROM: 'Twin <no-reply@x>' } as unknown as NodeJS.ProcessEnv;
  let seenConfig: unknown;
  const result = await sendPasswordResetEmail('a@x.co', LINK, {
    env,
    transport: (config) => { seenConfig = config; return { sendMail: async (m: Record<string, string>) => { sent.push(m); return {} as never; } } as never; },
  });
  assert.deepEqual(result, { delivered: true });
  assert.deepEqual(seenConfig, { host: 'smtp.x', port: 465, user: 'u', pass: 'p', from: 'Twin <no-reply@x>' });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'a@x.co');
  assert.equal(sent[0].from, 'Twin <no-reply@x>');
  assert.ok(sent[0].text.includes(LINK) && sent[0].html.includes(LINK));
});

test('SMTP failure: reported as not delivered, never thrown', async () => {
  const env = { SMTP_HOST: 'smtp.x', SMTP_FROM: 'f@x' } as unknown as NodeJS.ProcessEnv;
  const { result } = await quiet(() => sendPasswordResetEmail('a@x.co', LINK, {
    env, transport: () => ({ sendMail: async () => { throw new Error('connection refused'); } }) as never,
  }));
  assert.deepEqual(result, { delivered: false, reason: 'send-failed' });
});

test('link origin comes from APP_URL, never the request Host (reset poisoning)', () => {
  assert.equal(resetLinkOrigin('https://attacker.example', { APP_URL: 'https://twin.example.edu/' } as unknown as NodeJS.ProcessEnv), 'https://twin.example.edu');
  assert.equal(resetLinkOrigin('https://attacker.example', { NODE_ENV: 'production' } as unknown as NodeJS.ProcessEnv), null);
  assert.equal(resetLinkOrigin('http://localhost:3000', { NODE_ENV: 'development' } as unknown as NodeJS.ProcessEnv), 'http://localhost:3000');
});

test('smtpConfigFromEnv requires host and sender; default port 587', () => {
  assert.equal(smtpConfigFromEnv({} as unknown as NodeJS.ProcessEnv), null);
  assert.equal(smtpConfigFromEnv({ SMTP_HOST: 'h', SMTP_FROM: 'f' } as unknown as NodeJS.ProcessEnv)!.port, 587);
  assert.ok(buildResetEmail(LINK).subject.length > 0);
});
