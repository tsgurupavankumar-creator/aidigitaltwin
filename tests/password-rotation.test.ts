import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { generatePassword, planRotation, toCsv } from '../scripts/lib/password-rotation';
import { validatePasswordStrength } from '../src/lib/auth/password';

test('generatePassword: always strong, never repeats', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 300; i++) {
    const p = generatePassword();
    assert.equal(validatePasswordStrength(p).valid, true, p);
    assert.equal(p.length, 16);
    seen.add(p);
  }
  assert.equal(seen.size, 300);
});

test('planRotation: selects exactly the accounts on a published default', async () => {
  const hash = (p: string) => bcrypt.hashSync(p, 4);
  const users = [
    { id: '1', email: 's1@x', role: 'STUDENT', passwordHash: hash('Student@123') },
    { id: '2', email: 'f1@x', role: 'FACULTY', passwordHash: hash('Faculty@123') },
    { id: '3', email: 's2@x', role: 'STUDENT', passwordHash: hash('My0wn!Passw0rd') },
  ];
  const plan = await planRotation(users, (p, h) => bcrypt.compare(p, h), () => 'Fixed!Pass9word');
  assert.deepEqual(plan.map((p) => p.id), ['1', '2']);
  assert.ok(plan.every((p) => p.newPassword === 'Fixed!Pass9word'));
});

test('toCsv: header plus one escaped row per account', () => {
  const csv = toCsv([{ id: '1', email: 'a,b@x', role: 'STUDENT', newPassword: 'P"w' }]);
  assert.equal(csv, 'email,role,new_password\n"a,b@x",STUDENT,"P""w"\n');
});
