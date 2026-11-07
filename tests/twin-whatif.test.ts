import test from 'node:test';
import { fakeDb as db } from './helpers/stub-prisma';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { seedCourse } from './helpers/fake-db';

type Who = { role: 'faculty' | 'student'; facultyId?: string; studentId?: string } | null;
const who: { current: Who } = { current: null };
const ml = { up: true };

function stub(path: string, exports: object) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports, children: [], paths: [], path: '' } as unknown as NodeJS.Module;
}
stub('../src/lib/api-auth', {
  requireRole: async (role: string) => {
    const w = who.current;
    if (!w) return { error: new Response('{}', { status: 401 }) };
    if (w.role !== role) return { error: new Response('{}', { status: 403 }) };
    return { session: {}, user: { faculty: w.facultyId ? { id: w.facultyId } : null, student: w.studentId ? { id: w.studentId } : null } };
  },
});
// Monotone stand-in for the ML service: risk falls with attendance and rises with missed work.
stub('../src/lib/ml/client', {
  predictAttendance: async (_id: string, f: Record<string, number>) => ml.up
    ? { riskScore: Math.max(0, Math.min(1, 0.9 - f.currentAttendance / 120 + 0.08 * (f.earlyMissedCount ?? 0))), threshold: 0.4, confidence: 0.8, modelUsed: 'trained' }
    : { riskScore: 0.5, confidence: 0.3, modelUsed: 'fallback' },
  predictLearning: async (_id: string, f: Record<string, number>) => ({ nextExamScore: Math.min(100, 30 + 0.6 * f.avgQuizScore), low: 40, high: 80, confidence: 0.7, modelUsed: 'trained' }),
});

/* eslint-disable @typescript-eslint/no-var-requires */
const { applyScenario } = require('../src/lib/twin/what-if') as typeof import('../src/lib/twin/what-if');
const facultyWhatIf = require('../src/app/api/faculty/student/[id]/what-if/route');
const facultyHistory = require('../src/app/api/faculty/student/[id]/history/route');
const studentHistory = require('../src/app/api/student/history/route');
/* eslint-enable @typescript-eslint/no-var-requires */

const json = (body: unknown) => new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function reset() {
  for (const k of Object.keys(db.tables)) db.tables[k].length = 0;
  seedCourse(db);
  db.tables.faculty.push({ id: 'fac2' });
  // s1: attended 1 of 4 lectures, one quiz at 50%
  for (const [i, status] of ['PRESENT', 'ABSENT', 'ABSENT', 'ABSENT'].entries()) {
    db.tables.lecture.push({ id: `W${i}`, courseId: 'c1', date: new Date(Date.UTC(2026, 9, 1 + i)), time: '10:00', room: 'B' });
    db.tables.attendance.push({ id: `at${i}`, studentId: 's1', lectureId: `W${i}`, status, createdAt: new Date(Date.UTC(2026, 9, 1 + i)), updatedAt: new Date() });
  }
  db.tables.quizAttempt.push({ id: 'qa1', studentId: 's1', quizId: 'Q1', score: 1, percentage: 50, createdAt: new Date(Date.UTC(2026, 9, 3)) });
}

test('applyScenario changes exactly the inputs it should, both models consistently', () => {
  const early = { currentAttendance: 25, recentAttendance: 0, attendanceCount: 4, absenceRate: 0.75, earlyAvgScore: 50, earlyAssessedCount: 1, earlyMissedCount: 2, earlyLateCount: 1, presenceVsClass: -40, scoreVsClass: -10 };
  const learning = { avgMastery: 50, avgQuizScore: 50, avgSubmissionScore: 50, quizCount: 1, submissionCount: 1, quizTrend: 0, lastScore: 50, scoreTrend: 0, scoreStd: 0, lateCount: 1, missedCount: 2, nextIsAssignment: 0, nextIsExam: 0, relativeToClass: -10, classAvgPrior: 60, presenceRate: 0.25, recentPresenceRate: 0, daysSincePrevious: 3 };
  const { early: e, learning: l } = applyScenario(early, learning, { attendancePct: 90, quizAveragePct: 70, missedAssignments: 0 });
  assert.deepEqual([e.currentAttendance, e.recentAttendance, e.presenceVsClass], [90, 90, 25]);
  assert.ok(Math.abs(e.absenceRate - 0.1) < 1e-9);
  assert.deepEqual([l!.presenceRate, l!.recentPresenceRate], [0.9, 0.9]);
  assert.equal(l!.avgQuizScore, 70);
  assert.equal(l!.avgMastery, 60, 'half of the scored work is quizzes: +20 on quizzes moves the overall average +10');
  assert.equal(e.earlyAvgScore, 60);
  assert.deepEqual([e.earlyMissedCount, l!.missedCount, e.earlyLateCount], [0, 0, 1], 'late count untouched when not given');
  assert.equal(early.currentAttendance, 25, 'the input is not mutated');
});

test('what-if: better attendance and no missed work lowers predicted risk; nothing is saved', async () => {
  reset();
  who.current = { role: 'faculty', facultyId: 'fac1' };
  const before = JSON.stringify(db.tables);
  const res = await facultyWhatIf.POST(json({ attendancePct: 95, missedAssignments: 0 }), params('s1'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.current.attendancePct, 25);
  assert.ok(body.simulated.riskProbability < body.baseline.riskProbability, 'risk falls');
  assert.ok(body.assumptions.length >= 3);
  assert.equal(JSON.stringify(db.tables), before, 'a simulation never writes to the database');
});

test('what-if: faculty outside the student\'s courses get 404; bad input 400; ML down 503', async () => {
  reset();
  who.current = { role: 'faculty', facultyId: 'fac2' };
  assert.equal((await facultyWhatIf.POST(json({ attendancePct: 90 }), params('s1'))).status, 404);
  who.current = { role: 'faculty', facultyId: 'fac1' };
  assert.equal((await facultyWhatIf.POST(json({}), params('s1'))).status, 400);
  assert.equal((await facultyWhatIf.POST(json({ attendancePct: 150 }), params('s1'))).status, 400);
  ml.up = false;
  try {
    const res = await facultyWhatIf.POST(json({ attendancePct: 90 }), params('s1'));
    assert.equal(res.status, 503);
    assert.match((await res.json()).error, /no trained model/);
  } finally { ml.up = true; }
});

test('history: oldest first, capped at 60; access checked; students only see their own', async () => {
  reset();
  for (let i = 0; i < 65; i++) {
    db.tables.twinSnapshot.push({ id: `sn${i}`, studentId: 's1', createdAt: new Date(Date.UTC(2026, 9, 1, 0, i)), academicHealth: i, performanceScore: 0, attendanceScore: 0, engagementScore: 0, knowledgeScore: 0, learningVelocity: 0.5, behaviorScore: 0, skillsScore: 0, riskScore: 10, riskLevel: 'LOW', event: 'weekly_review' });
  }
  db.tables.twinSnapshot.push({ id: 'other', studentId: 's2', createdAt: new Date(), academicHealth: 99, performanceScore: 0, attendanceScore: 0, engagementScore: 0, knowledgeScore: 0, learningVelocity: 0.5, behaviorScore: 0, skillsScore: 0, riskScore: 1, riskLevel: 'LOW', event: 'x' });
  who.current = { role: 'faculty', facultyId: 'fac1' };
  const h = (await (await facultyHistory.GET(new NextRequest('http://localhost/x'), params('s1'))).json()).history;
  assert.equal(h.length, 60);
  assert.deepEqual([h[0].academicHealth, h[59].academicHealth], [5, 64], 'latest 60, oldest first');
  who.current = { role: 'faculty', facultyId: 'fac2' };
  assert.equal((await facultyHistory.GET(new NextRequest('http://localhost/x'), params('s1'))).status, 404);
  who.current = { role: 'student', studentId: 's2' };
  const own = (await (await studentHistory.GET()).json()).history;
  assert.deepEqual(own.map((r: { academicHealth: number }) => r.academicHealth), [99]);
});
