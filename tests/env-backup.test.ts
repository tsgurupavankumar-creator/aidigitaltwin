import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const tsxCli = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
const script = (name: string) => join(process.cwd(), 'scripts', name);
const SECRET = 'DATABASE_URL="postgresql://u:SECRET@host/db"\n';

function run(name: string, cwd: string, home: string) {
  return execFileSync(process.execPath, [tsxCli, script(name)], {
    cwd, encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home }, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function sandbox() {
  const root = mkdtempSync(join(tmpdir(), 'envbak-'));
  const home = join(root, 'home'); const proj = join(root, 'proj');
  for (const d of [home, proj]) require('node:fs').mkdirSync(d);
  return { root, home, proj };
}

test('env:backup keeps the copy in the user profile only, never inside the project folder', () => {
  const { root, home, proj } = sandbox();
  try {
    writeFileSync(join(proj, '.env'), SECRET);
    run('backup-env.ts', proj, home);
    const durable = join(home, '.academic-digital-twin', '.env.backup');
    assert.equal(readFileSync(durable, 'utf8'), SECRET);
    assert.equal(existsSync(join(proj, '.env.backup')), false, 'no secret copy inside the project (it would be zipped)');
    if (process.platform !== 'win32') assert.equal(statSync(durable).mode & 0o777, 0o600);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('env:restore restores a missing .env from the profile backup and never overwrites an existing one', () => {
  const { root, home, proj } = sandbox();
  try {
    writeFileSync(join(proj, '.env'), SECRET);
    run('backup-env.ts', proj, home);
    rmSync(join(proj, '.env'));
    run('restore-env.ts', proj, home);
    assert.equal(readFileSync(join(proj, '.env'), 'utf8'), SECRET);
    writeFileSync(join(proj, '.env'), 'CHANGED=1\n');
    run('restore-env.ts', proj, home);
    assert.equal(readFileSync(join(proj, '.env'), 'utf8'), 'CHANGED=1\n');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('env:backup refuses an empty .env (does not wipe a good backup)', () => {
  const { root, home, proj } = sandbox();
  try {
    writeFileSync(join(proj, '.env'), SECRET);
    run('backup-env.ts', proj, home);
    writeFileSync(join(proj, '.env'), '');
    assert.throws(() => run('backup-env.ts', proj, home));
    assert.equal(readFileSync(join(home, '.academic-digital-twin', '.env.backup'), 'utf8'), SECRET);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
