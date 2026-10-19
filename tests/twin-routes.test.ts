/**
 * HTTP-level checks of the new data routes: ownership, enrollment, no answer
 * leakage, and that a save queues exactly the twin updates for what changed.
 */
import test from 'node:test';
import { fakeDb as db } from './helpers/stub-prisma';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { seedCourse } from './helpers/fake-db';

type Who = { role: 'faculty' | 'student'; facultyId?: string; studentId?: string } | null;
const who: { current: Who } = { current: null };
const queued: unknown[][] = [];

function stub(path: string, exports: object) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports, children: [], paths: [], path: '' } as unknown as NodeJS.Module;
}
stub('../src/lib/api-auth', {
  requireRole: async (role: string) => {
    const w = who.current;
    if (!w) return { error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) };
    if (w.role !== role) return { error: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) };
    return { session: {}, user: { faculty: w.facultyId ? { id: w.facultyId } : null, student: w.studentId ? { id: w.studentId } : null } };
  },
});
stub('../src/lib/twin/sync', { scheduleTwinSync: (tasks: unknown[]) => { queued.push(tasks); return tasks.length; } });

/* eslint-disable @typescript-eslint/no-var-requires */
const attendance = require('../src/app/api/faculty/courses/[courseId]/lectures/[lectureId]/attendance/route');
const quizGet = require('../src/app/api/student/quizzes/[quizId]/route');
const quizAttempt = require('../src/app/api/student/quizzes/[quizId]/attempts/route');
const grades = require('../src/app/api/faculty/courses/[courseId]/assignments/[assignmentId]/grades/route');
/* eslint-enable @typescript-eslint/no-var-requires */

const json = (body: unknown, method = 'PUT') => new NextRequest('http://localhost/x', { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const params = <T,>(p: T) => ({ params: Promise.resolve(p) });

function reset() {
  for (const k of Object.keys(db.tables)) db.tables[k].length = 0;
  seedCourse(db);
  db.tables.faculty.push({ id: 'fac2' });
  queued.length = 0;
}

test('attendance PUT: owner saves and twin updates are queued for exactly the changed students', async () => {
  reset();
  who.current = { role: 'faculty', facultyId: 'fac1' };
  const res = await attendance.PUT(json({ records: [{ studentId: 's1', status: 'ABSENT' }, { studentId: 's2', status: 'PRESENT' }] }), params({ courseId: 'c1', lectureId: 'L1' }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { saved: 2, unchanged: 0, twinUpdatesQueued: 2 });
  const again = await attendance.PUT(json({ records: [{ studentId: 's1', status: 'ABSENT' }] }), params({ courseId: 'c1', lectureId: 'L1' }));
  assert.deepEqual(await again.json(), { saved: 0, unchanged: 1, twinUpdatesQueued: 0 });
});

test('attendance PUT: another faculty member gets 404 and nothing is written; no session gets 401', async () => {
  reset();
  who.current = { role: 'faculty', facultyId: 'fac2' };
  const res = await attendance.PUT(json({ records: [{ studentId: 's1', status: 'ABSENT' }] }), params({ courseId: 'c1', lectureId: 'L1' }));
  assert.equal(res.status, 404);
  assert.equal(db.tables.attendance.length, 0);
  who.current = null;
  assert.equal((await attendance.PUT(json({ records: [] }), params({ courseId: 'c1', lectureId: 'L1' }))).status, 401);
  who.current = { role: 'student', studentId: 's1' };
  assert.equal((await attendance.PUT(json({ records: [] }), params({ courseId: 'c1', lectureId: 'L1' }))).status, 403);
});

test('attendance PUT: invalid body is a 400, a student from another course is a 400', async () => {
  reset();
  who.current = { role: 'faculty', facultyId: 'fac1' };
  assert.equal((await attendance.PUT(json({ records: [{ studentId: 's1', status: 'MAYBE' }] }), params({ courseId: 'c1', lectureId: 'L1' }))).status, 400);
  const res = await attendance.PUT(json({ records: [{ studentId: 'outsider', status: 'PRESENT' }] }), params({ courseId: 'c1', lectureId: 'L1' }));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /not enrolled/);
});

test('grades PUT: marks above the maximum are refused with 400', async () => {
  reset();
  who.current = { role: 'faculty', facultyId: 'fac1' };
  const res = await grades.PUT(json({ grades: [{ studentId: 's1', marksObtained: 99 }] }), params({ courseId: 'c1', assignmentId: 'A1' }));
  assert.equal(res.status, 400);
  assert.equal(db.tables.submission.length, 0);
});

test('student quiz GET: enrolled student sees questions WITHOUT correct answers; outsider gets 404', async () => {
  reset();
  who.current = { role: 'student', studentId: 's1' };
  const res = await quizGet.GET(new NextRequest('http://localhost/x'), params({ quizId: 'Q1' }));
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.equal(JSON.parse(text).quiz.questions.length, 3);
  assert.ok(!/correctAnswer|INNER JOIN|Third normal form/.test(text), 'answers must never be sent before submission');
  who.current = { role: 'student', studentId: 'outsider' };
  assert.equal((await quizGet.GET(new NextRequest('http://localhost/x'), params({ quizId: 'Q1' }))).status, 404);
});

test('quiz attempt POST: graded on the server and one twin update queued', async () => {
  reset();
  who.current = { role: 'student', studentId: 's3' };
  const res = await quizAttempt.POST(json({ answers: { q1: 'INNER JOIN', q2: 'True', q3: 'third normal form' } }, 'POST'), params({ quizId: 'Q1' }));
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.deepEqual([body.score, body.total, body.percentage, body.twinUpdatesQueued], [3, 3, 100, 1]);
  assert.equal(db.tables.quizAttempt.length, 1);
});

test('student quiz GET: no session is 401 before any quiz lookup (no probing which quizzes exist)', async () => {
  reset();
  who.current = null;
  let looked = 0;
  const original = db.quiz.findUnique;
  db.quiz.findUnique = async (a: unknown) => { looked += 1; return original(a); };
  const res = await quizGet.GET(new NextRequest('http://localhost/x'), params({ quizId: 'Q1' }));
  db.quiz.findUnique = original;
  assert.equal(res.status, 401);
  assert.equal(looked, 0);
});
