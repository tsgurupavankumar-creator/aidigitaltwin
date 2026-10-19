/**
 * Route-handler tests with a stubbed database (module cache pre-populated before
 * the routes load). They execute the REAL handlers, so the guards run for real.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const db = {
  users: new Map<string, Any>(), resets: [] as Any[], audit: [] as Any[], userUpdates: [] as Any[], sessionsDeleted: [] as Any[],
  course: { id: 'c1' } as Any | null, counts: {} as Record<string, number>, courseDeleted: false,
  rollMatch: null as Any, nameMatches: [] as Any[], existingEnrollment: null as Any, enrollments: [] as Any[],
  courseDetail: null as Any,
};
const count = (k: string) => async () => db.counts[k] ?? 0;
const fakePrisma = {
  user: { findUnique: async ({ where }: Any) => db.users.get(where.email) ?? null, update: async (a: Any) => { db.userUpdates.push(a); return a; } },
  passwordReset: {
    create: async ({ data }: Any) => { const r = { id: `r${db.resets.length + 1}`, usedAt: null, ...data }; db.resets.push(r); return r; },
    findUnique: async ({ where }: Any) => { const r = db.resets.find((x) => x.token === where.token); return r ? { ...r, user: [...db.users.values()].find((u) => u.id === r.userId) } : null; },
    update: async ({ where, data }: Any) => { const r = db.resets.find((x) => x.id === where.id); Object.assign(r, data); return r; },
  },
  session: { deleteMany: async (a: Any) => { db.sessionsDeleted.push(a); return { count: 1 }; } },
  auditLog: { create: async (a: Any) => { db.audit.push(a); return a; } },
  $transaction: async (ops: Any[]) => Promise.all(ops),
  course: {
    findFirst: async (a: Any) => (a.include ? db.courseDetail : db.course),
    delete: async () => { db.courseDeleted = true; return {}; },
  },
  enrollment: { count: count('enrollments'), findUnique: async () => db.existingEnrollment, create: async (a: Any) => { db.enrollments.push(a); return a; } },
  lecture: { count: count('lectures') }, topic: { count: count('topics') }, concept: { count: count('concepts') },
  assignment: { count: count('assignments') }, quiz: { count: count('quizzes') }, classInsight: { count: count('insights') },
  student: { findFirst: async () => db.rollMatch, findMany: async () => db.nameMatches },
};
function stub(path: string, exports: object) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports, children: [], paths: [], path: '' } as unknown as NodeJS.Module;
}
stub('../src/lib/prisma', { prisma: fakePrisma });
stub('../src/lib/api-auth', { requireRole: async () => ({ user: { faculty: { id: 'fac1' } } }) });
const forgot = require('../src/app/api/auth/forgot-password/route') as Any;
const reset = require('../src/app/api/auth/reset-password/route') as Any;
const courseRoute = require('../src/app/api/faculty/courses/[courseId]/route') as Any;

let ipCounter = 0;
const req = (url: string, method: string, body?: object, ip?: string) =>
  new NextRequest(`http://localhost:3000${url}`, { method, headers: { 'content-type': 'application/json', 'x-forwarded-for': ip ?? `10.0.0.${++ipCounter}` }, body: body ? JSON.stringify(body) : undefined });
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
async function captureRawToken(run: () => Promise<Response>) {
  const orig = console.log; let link = '';
  console.log = (...a: unknown[]) => { const s = a.join(' '); if (s.includes('/reset-password?token=')) link = s; };
  try { const res = await run(); return { res, token: link.split('token=')[1] ?? '' }; } finally { console.log = orig; }
}
db.users.set('ana@x.co', { id: 'u1', email: 'ana@x.co', status: 'ACTIVE' });

test('forgot-password: known and unknown emails get IDENTICAL responses (no account enumeration)', async () => {
  const known = await forgot.POST(req('/api/auth/forgot-password', 'POST', { email: 'ana@x.co' }));
  const unknown = await forgot.POST(req('/api/auth/forgot-password', 'POST', { email: 'nobody@x.co' }));
  assert.equal(known.status, unknown.status);
  assert.deepEqual(await known.json(), await unknown.json());
});

test('forgot-password: stores only a HASH of the token, 1-hour expiry, audit row; unknown email stores nothing', async () => {
  db.resets.length = 0; db.audit.length = 0;
  const { token } = await captureRawToken(() => forgot.POST(req('/api/auth/forgot-password', 'POST', { email: 'ana@x.co' })));
  assert.equal(db.resets.length, 1);
  assert.ok(token.length >= 40, 'a raw token was issued to the (logged) link');
  assert.notEqual(db.resets[0].token, token, 'the raw token must not be what is stored');
  assert.equal(db.resets[0].token, sha(token));
  const ttl = db.resets[0].expiresAt.getTime() - Date.now();
  assert.ok(ttl > 59 * 60e3 && ttl <= 60 * 60e3, `expiry ~1h, got ${ttl}ms`);
  assert.equal(db.audit.length, 1);
  db.resets.length = 0;
  await forgot.POST(req('/api/auth/forgot-password', 'POST', { email: 'ghost@x.co' }));
  assert.equal(db.resets.length, 0);
});

test('forgot-password: rate limited after 5 requests for the same email, even from different IPs', async () => {
  const codes: number[] = [];
  for (let i = 0; i < 7; i++) codes.push((await forgot.POST(req('/api/auth/forgot-password', 'POST', { email: 'flood@x.co' }))).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429, 429]);
});

test('reset-password: full flow. The password really changes, the token is single-use, sessions are cleared', async () => {
  db.resets.length = 0; db.userUpdates.length = 0; db.sessionsDeleted.length = 0;
  const { token } = await captureRawToken(() => forgot.POST(req('/api/auth/forgot-password', 'POST', { email: 'ana@x.co' })));
  const good = { token, password: 'Str0ng!Passw0rd', confirmPassword: 'Str0ng!Passw0rd' };

  const weak = await reset.POST(req('/api/auth/reset-password', 'POST', { token, password: 'abcdefgh', confirmPassword: 'abcdefgh' }));
  assert.equal(weak.status, 400);
  assert.equal((await weak.json()).code, 'WEAK_PASSWORD');
  assert.equal(db.resets[0].usedAt, null, 'a rejected weak password must not burn the token');

  const mismatch = await reset.POST(req('/api/auth/reset-password', 'POST', { ...good, confirmPassword: 'different' }));
  assert.equal(mismatch.status, 400);

  const ok = await reset.POST(req('/api/auth/reset-password', 'POST', good));
  assert.equal(ok.status, 200);
  assert.equal(db.userUpdates.length, 1);
  assert.ok(await bcrypt.compare(good.password, db.userUpdates[0].data.passwordHash), 'stored hash verifies the NEW password');
  assert.notEqual(db.userUpdates[0].data.passwordHash, good.password);
  assert.ok(db.resets[0].usedAt instanceof Date);
  assert.equal(db.sessionsDeleted.length, 1);

  const replay = await reset.POST(req('/api/auth/reset-password', 'POST', good));
  assert.equal(replay.status, 400);
  assert.equal((await replay.json()).code, 'INVALID_TOKEN');
});

test('reset-password: expired and unknown tokens get the same generic error (indistinguishable)', async () => {
  db.resets.push({ id: 'rx', userId: 'u1', token: sha('expired-token'), expiresAt: new Date(Date.now() - 1000), usedAt: null });
  const good = { password: 'Str0ng!Passw0rd', confirmPassword: 'Str0ng!Passw0rd' };
  const expired = await reset.POST(req('/api/auth/reset-password', 'POST', { token: 'expired-token', ...good }));
  const unknown = await reset.POST(req('/api/auth/reset-password', 'POST', { token: 'never-issued', ...good }));
  assert.equal(expired.status, 400);
  assert.deepEqual(await expired.json(), await unknown.json());
});

test('DELETE course: 404 when not yours; 409 and NOTHING deleted when it holds data; deleted only when empty', async () => {
  const call = () => courseRoute.DELETE(req('/api/faculty/courses/c1', 'DELETE'), { params: { courseId: 'c1' } });
  db.course = null;
  assert.equal((await call()).status, 404);
  db.course = { id: 'c1' }; db.courseDeleted = false;
  db.counts = { enrollments: 3, assignments: 2, concepts: 13 };
  const blocked = await call();
  assert.equal(blocked.status, 409);
  const body = await blocked.json();
  assert.equal(body.code, 'COURSE_HAS_DATA');
  assert.match(body.error, /3 enrollments/); assert.match(body.error, /2 assignments/); assert.match(body.error, /13 concepts/);
  assert.equal(db.courseDeleted, false, 'a course with data must NOT be deleted');
  db.counts = {};
  const done = await call();
  assert.equal(done.status, 200);
  assert.equal(db.courseDeleted, true);
});

test('each single kind of data is enough to block deletion', async () => {
  for (const kind of ['enrollments', 'lectures', 'topics', 'concepts', 'assignments', 'quizzes', 'insights']) {
    db.courseDeleted = false; db.counts = { [kind]: 1 };
    const res = await courseRoute.DELETE(req('/api/faculty/courses/c1', 'DELETE'), { params: { courseId: 'c1' } });
    assert.equal(res.status, 409, `${kind} should block deletion`);
    assert.equal(db.courseDeleted, false);
  }
});

test('enroll: roll number wins; duplicate names are refused (409); unique name works; unknown 404; repeat is idempotent', async () => {
  const enroll = (studentName: string) => courseRoute.POST(req('/api/faculty/courses/c1', 'POST', { studentName }), { params: { courseId: 'c1' } });
  const s1 = { id: 's1', fullName: 'Asha Rao', rollNumber: '24BCE0001' };
  db.course = { id: 'c1' };

  db.rollMatch = s1; db.nameMatches = []; db.existingEnrollment = null; db.enrollments.length = 0;
  assert.equal((await enroll('24bce0001')).status, 201);
  assert.equal(db.enrollments[0].data.studentId, 's1');

  db.rollMatch = null; db.nameMatches = [s1, { id: 's2', fullName: 'Asha Rao', rollNumber: '24BCE0002' }]; db.enrollments.length = 0;
  const amb = await enroll('Asha Rao');
  assert.equal(amb.status, 409);
  assert.equal((await amb.json()).code, 'AMBIGUOUS_STUDENT');
  assert.equal(db.enrollments.length, 0, 'must not enrol anyone when the name is ambiguous');

  db.nameMatches = [s1];
  assert.equal((await enroll('Asha Rao')).status, 201);
  db.nameMatches = [];
  assert.equal((await enroll('Nobody Here')).status, 404);
  db.nameMatches = [s1]; db.existingEnrollment = { id: 'e1' }; db.enrollments.length = 0;
  const again = await enroll('Asha Rao');
  assert.equal((await again.json()).data.alreadyEnrolled, true);
  assert.equal(db.enrollments.length, 0);
});

test('course detail: students with no data come back as null, not invented 75 / 85 / LOW / 25', async () => {
  db.courseDetail = { id: 'c1', code: 'CS-1', name: 'DB', department: 'CSE', semester: 3, lectures: [],
    enrollments: [{ student: { id: 's9', rollNumber: 'R9', fullName: 'No Data', digitalTwin: null, riskAssessments: [], attendance: [] } }] };
  const res = await courseRoute.GET(req('/api/faculty/courses/c1', 'GET'), { params: { courseId: 'c1' } });
  const { data } = await res.json();
  assert.deepEqual(data.students[0], { id: 's9', rollNumber: 'R9', name: 'No Data', academicHealth: null, attendance: null, riskLevel: null, riskScore: null });
  assert.equal(data.avgHealth, null);
  assert.equal(data.avgAttendance, null);
  assert.equal(data.schedule, null);
  assert.equal('section' in data, false);
});
