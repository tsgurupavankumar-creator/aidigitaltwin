/** getAuthSession(): a validly signed cookie is only accepted while its Session row exists. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
process.env.JWT_SECRET = 'test-secret-for-session-revocation-0123456789';

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const state = { cookie: undefined as string | undefined, rows: [] as Any[], queries: 0 };
const fakePrisma = {
  session: {
    findFirst: async ({ where }: Any) => {
      state.queries += 1;
      return state.rows.find((r) => r.tokenHash === where.tokenHash && r.expiresAt > where.expiresAt.gt) ?? null;
    },
    deleteMany: async ({ where }: Any) => { state.rows = state.rows.filter((r) => r.tokenHash !== where.tokenHash); return { count: 1 }; },
  },
};
function stub(path: string, exports: object) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports, children: [], paths: [], path: '' } as unknown as NodeJS.Module;
}
stub('next/headers', { cookies: () => ({ get: (name: string) => (state.cookie ? { name, value: state.cookie } : undefined), set: () => undefined }) });
stub('../src/lib/prisma', { prisma: fakePrisma });
const { getAuthSession } = require('../src/lib/auth/session') as Any;
const { signToken } = require('../src/lib/auth/jwt') as Any;
const payload = { userId: 'u1', role: 'STUDENT', name: 'A', email: 'a@x.co', rollNumber: 'R1', department: 'CSE' };
const sevenDays = 7 * 24 * 60 * 60 * 1000;
const issue = async (rowOver: Partial<Any> = {}) => {
  const token = await signToken(payload);
  state.cookie = token; state.queries = 0;
  state.rows = [{ tokenHash: sha(token), expiresAt: new Date(Date.now() + sevenDays), ...rowOver }];
  return token;
};

test('valid signature + live session row -> accepted', async () => {
  await issue();
  const s = await getAuthSession();
  assert.equal(s?.id, 'u1');
  assert.equal(s?.role, 'STUDENT');
});

test('LOGOUT revokes: the same cookie is refused once its row is deleted (as the logout route does)', async () => {
  const token = await issue();
  assert.ok(await getAuthSession());
  await fakePrisma.session.deleteMany({ where: { tokenHash: sha(token) } });
  assert.equal(await getAuthSession(), null);
});

test('PASSWORD RESET revokes: rows deleted by userId make the old cookie useless', async () => {
  await issue(); state.rows = [];          // what reset-password does: session.deleteMany({ userId })
  assert.equal(await getAuthSession(), null);
});

test('an expired session row is refused even though the JWT itself is still valid', async () => {
  await issue({ expiresAt: new Date(Date.now() - 1000) });
  assert.equal(await getAuthSession(), null);
});

test('a row belonging to a different token never validates this cookie', async () => {
  await issue({ tokenHash: sha('some-other-token') });
  assert.equal(await getAuthSession(), null);
});

test('no cookie, garbage, and a tampered signature are all refused WITHOUT touching the database', async () => {
  state.queries = 0; state.cookie = undefined;
  assert.equal(await getAuthSession(), null);
  state.cookie = 'not-a-jwt'; assert.equal(await getAuthSession(), null);
  const good = await signToken(payload);
  state.cookie = good.slice(0, -4) + (good.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  assert.equal(await getAuthSession(), null);
  assert.equal(state.queries, 0);
});
