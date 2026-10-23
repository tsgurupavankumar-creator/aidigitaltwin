import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

process.env.JWT_SECRET = randomBytes(48).toString('base64');

const PLACEHOLDER = 'generate-a-32-character-minimum-secret-here';

test('isUsableSecret: refuses the published .env.example placeholder', async () => {
  const { isUsableSecret } = await import('../src/lib/auth/jwt');
  assert.equal(isUsableSecret(PLACEHOLDER), false);
  assert.equal(isUsableSecret('generate-another-32-char-secret-here'), false);
});

test('isUsableSecret: refuses missing, short and obvious placeholder secrets', async () => {
  const { isUsableSecret } = await import('../src/lib/auth/jwt');
  for (const s of [undefined, '', 'short', 'x'.repeat(31), 'please-change-me-to-a-long-random-value-123', 'your-secret-goes-here-0123456789abcdef']) {
    assert.equal(isUsableSecret(s as string | undefined), false, String(s));
  }
});

test('isUsableSecret: accepts a real random secret', async () => {
  const { isUsableSecret } = await import('../src/lib/auth/jwt');
  assert.equal(isUsableSecret(randomBytes(48).toString('base64')), true);
});

test('the server refuses to start with the placeholder secret', () => {
  const script = "import('./src/lib/auth/jwt').then(()=>{console.log('STARTED');process.exit(0)}).catch(e=>{console.log('REFUSED:'+e.message);process.exit(0)})";
  const env = { ...process.env, JWT_SECRET: PLACEHOLDER };
  const tsxCli = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const out = execFileSync(process.execPath, [tsxCli, '-e', script], {
    env,
    encoding: 'utf8',
    cwd: process.cwd(),
  });
  assert.match(out, /REFUSED:.*placeholder/);
});

test('.env.example no longer ships a usable secret', async () => {
  const { readFileSync } = await import('node:fs');
  const { isUsableSecret } = await import('../src/lib/auth/jwt');
  const env = readFileSync('.env.example', 'utf8');
  const m = env.match(/^JWT_SECRET=("?)(.*)\1\s*$/m);
  assert.ok(m, 'JWT_SECRET line present');
  assert.equal(isUsableSecret(m![2]), false);
});
