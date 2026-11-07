import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

function stub(path: string, exports: object) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports, children: [], paths: [], path: '' } as unknown as NodeJS.Module;
}
const state = {
  session: { id: 'u1', role: 'STUDENT', email: 'a@x' } as null | { id: string; role: string; email: string },
  user: { id: 'u1', role: 'STUDENT', status: 'ACTIVE', mustChangePassword: true, passwordHash: '', student: { id: 's1' }, faculty: null } as Record<string, unknown>,
  sessions: [] as Array<{ userId: string; tokenHash: string }>,
  audits: [] as string[],
};
const fakePrisma = {
  user: {
    findUnique: async () => ({ ...state.user }),
    update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(state.user, data),
  },
  session: {
    deleteMany: async ({ where }: { where: { userId: string; NOT?: { tokenHash: string } } }) => {
      state.sessions = state.sessions.filter((s) => !(s.userId === where.userId && (!where.NOT || s.tokenHash !== where.NOT.tokenHash)));
    },
  },
  auditLog: { create: async ({ data }: { data: { event: string } }) => { state.audits.push(data.event); } },
  $transaction: async (ops: Array<Promise<unknown>>) => Promise.all(ops),
};
stub('../src/lib/prisma', { prisma: fakePrisma, default: fakePrisma });
stub('../src/lib/auth/session', { getAuthSession: async () => state.session });
stub('next/headers', { cookies: async () => ({ get: () => ({ value: 'current-token' }) }) });

/* eslint-disable @typescript-eslint/no-var-requires */
const { requireRole, tokenHash } = require('../src/lib/api-auth') as typeof import('../src/lib/api-auth');
const route = require('../src/app/api/auth/change-password/route');
/* eslint-enable @typescript-eslint/no-var-requires */

const post = (body: unknown) => route.POST(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }));

test('an account with a temporary password is blocked from every role-protected API until it sets its own', async () => {
  state.user.mustChangePassword = true;
  const r = await requireRole('student');
  assert.ok('error' in r);
  const res = (r as { error: Response }).error;
  assert.equal(res.status, 403);
  assert.equal((await res.json()).code, 'PASSWORD_CHANGE_REQUIRED');
  state.user.mustChangePassword = false;
  assert.ok(!('error' in (await requireRole('student'))), 'allowed once changed');
});

test('change password: wrong current, weak new, or same password are refused', async () => {
  state.user.passwordHash = await bcrypt.hash('Temp@1234x', 4);
  assert.equal((await post({ currentPassword: 'nope', newPassword: 'Better@2026' })).status, 400);
  assert.match((await (await post({ currentPassword: 'Temp@1234x', newPassword: 'short' })).json()).error, /needs/);
  assert.match((await (await post({ currentPassword: 'Temp@1234x', newPassword: 'Temp@1234x' })).json()).error, /different/);
});

test('change password: success clears the flag and signs out every OTHER session, keeping this one', async () => {
  state.user.mustChangePassword = true;
  state.user.passwordHash = await bcrypt.hash('Temp@1234x', 4);
  state.sessions = [{ userId: 'u1', tokenHash: tokenHash('current-token') }, { userId: 'u1', tokenHash: 'other-device' }, { userId: 'u2', tokenHash: 'someone-else' }];
  const res = await post({ currentPassword: 'Temp@1234x', newPassword: 'Better@2026' });
  assert.equal(res.status, 200);
  assert.equal(state.user.mustChangePassword, false);
  assert.ok(await bcrypt.compare('Better@2026', state.user.passwordHash as string));
  assert.deepEqual(state.sessions.map((s) => s.tokenHash), [tokenHash('current-token'), 'someone-else']);
  assert.ok(state.audits.includes('PASSWORD_CHANGED'));
});

test('change password requires being signed in', async () => {
  const saved = state.session; state.session = null;
  try { assert.equal((await post({ currentPassword: 'a', newPassword: 'b' })).status, 401); } finally { state.session = saved; }
});

test('routes that check the session directly also refuse an account that must change its password', async () => {
  const { blockIfPasswordChangeRequired } = require('../src/lib/api-auth') as typeof import('../src/lib/api-auth');
  state.user.mustChangePassword = true;
  assert.equal((await blockIfPasswordChangeRequired('u1'))?.status, 403);
  state.user.mustChangePassword = false;
  assert.equal(await blockIfPasswordChangeRequired('u1'), null);
});
