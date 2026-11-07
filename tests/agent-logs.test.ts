/** GET /api/agents/logs/[studentId]: who may read a student's agent logs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const state = { session: { id: 'u1' } as Any, requester: null as Any, faculty: { id: 'fac1' } as Any, enrolled: null as Any, logsRead: 0 };
const fakePrisma = {
  user: { findUnique: async () => state.requester },
  faculty: { findUnique: async () => state.faculty },
  enrollment: { findFirst: async () => state.enrolled },
  agentLog: { findMany: async () => { state.logsRead += 1; return [{ id: 'log1' }]; } },
};
function stub(path: string, exports: object) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports, children: [], paths: [], path: '' } as unknown as NodeJS.Module;
}
stub('../src/lib/prisma', { prisma: fakePrisma });
stub('../src/lib/auth/session', { getAuthSession: async () => state.session });
const route = require('../src/app/api/agents/logs/[studentId]/route') as Any;
const get = (studentId: string) => route.GET(new NextRequest(`http://localhost:3000/api/agents/logs/${studentId}`), { params: { studentId } });
const as = (role: string, extra: object = {}) => { state.requester = { id: 'u1', role, status: 'ACTIVE', student: null, ...extra }; state.logsRead = 0; };

test('no session -> 401, and inactive account -> 401', async () => {
  state.session = null; assert.equal((await get('s1')).status, 401);
  state.session = { id: 'u1' }; as('FACULTY', { status: 'SUSPENDED' }); assert.equal((await get('s1')).status, 401);
});

test('a student can read their own logs but not another student\'s', async () => {
  as('STUDENT', { student: { id: 's1' } });
  assert.equal((await get('s1')).status, 200);
  state.logsRead = 0;
  assert.equal((await get('s2')).status, 403);
  assert.equal(state.logsRead, 0, 'logs must not even be queried for a forbidden request');
});

test('THE BUG: a faculty member NOT teaching this student is refused (403) and no logs are read', async () => {
  as('FACULTY'); state.enrolled = null;
  const res = await get('s-not-mine');
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'Not your student');
  assert.equal(state.logsRead, 0);
});

test('a faculty member can read logs of a student enrolled in their own course', async () => {
  as('FACULTY'); state.enrolled = { id: 'e1' };
  assert.equal((await get('s1')).status, 200);
  assert.equal(state.logsRead, 1);
});

test('a faculty account with no Faculty profile row is refused', async () => {
  as('FACULTY'); state.faculty = null; state.enrolled = { id: 'e1' };
  assert.equal((await get('s1')).status, 403);
  state.faculty = { id: 'fac1' };
});

test('an admin can read any student\'s logs', async () => {
  as('ADMIN');
  assert.equal((await get('anyone')).status, 200);
});
