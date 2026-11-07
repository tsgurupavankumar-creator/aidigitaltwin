import test from 'node:test';
import { fakeDb as sharedDb } from './helpers/stub-prisma';
import assert from 'node:assert/strict';
import { FakeDb, seedCourse } from './helpers/fake-db';
import type { OrchestrationResult } from '../src/lib/agents/types';

// The ML service is stubbed: risk rises as attendance falls, always "trained".
const mlId = require.resolve('../src/lib/ml/client');
require.cache[mlId] = {
  id: mlId, filename: mlId, loaded: true, children: [], paths: [], path: '',
  exports: {
    predictAttendance: async (_id: string, f: Record<string, number>) => ({ riskScore: Math.max(0, Math.min(1, 1 - f.currentAttendance / 100)), confidence: 0.8, modelUsed: 'trained' }),
    predictLearning: async () => ({ nextExamScore: 70, confidence: 0.7, modelUsed: 'trained' }),
  },
} as unknown as NodeJS.Module;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const records = require('../src/lib/twin/records') as typeof import('../src/lib/twin/records');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { importCsv } = require('../src/lib/twin/import') as typeof import('../src/lib/twin/import');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { runTwinSync } = require('../src/lib/twin/sync') as typeof import('../src/lib/twin/sync');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { orchestrate } = require('../src/lib/agents/orchestrator') as typeof import('../src/lib/agents/orchestrator');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { refreshCourseInsight } = require('../src/lib/twin/class-insights') as typeof import('../src/lib/twin/class-insights');

const fresh = () => seedCourse(new FakeDb());

// ------------------------------------------------------------ attendance

test('attendance: saves only changes, rejects students outside the course, returns one task per change', async () => {
  const db = fresh();
  const r1 = await records.saveAttendance(db as never, 'c1', 'L1', [{ studentId: 's1', status: 'PRESENT' }, { studentId: 's2', status: 'ABSENT' }]);
  assert.equal(r1.saved, 2);
  assert.ok(r1.tasks.every((t) => t.event === 'attendance_marked' && /^attendance:att\d+:/.test(t.sourceKey!)));
  const r2 = await records.saveAttendance(db as never, 'c1', 'L1', [{ studentId: 's1', status: 'PRESENT' }, { studentId: 's2', status: 'LATE' }]);
  assert.deepEqual([r2.saved, r2.unchanged], [1, 1]);
  assert.equal(db.tables.attendance.length, 2);
  await assert.rejects(records.saveAttendance(db as never, 'c1', 'L1', [{ studentId: 'outsider', status: 'PRESENT' }]), /not enrolled/);
  await assert.rejects(records.saveAttendance(db as never, 'c1', 'nope', [{ studentId: 's1', status: 'PRESENT' }]), /Lecture not found/);
  await assert.rejects(records.saveAttendance(db as never, 'c1', 'L1', [{ studentId: 's1', status: 'PRESENT' }, { studentId: 's1', status: 'ABSENT' }]), /only once/);
});

// ------------------------------------------------------------ grades

test('grades: bounds-checked, update mastery for the assessed concepts, unchanged grades skipped', async () => {
  const db = fresh();
  await assert.rejects(records.saveGrades(db as never, 'c1', 'A1', [{ studentId: 's1', marksObtained: 21 }]), /between 0 and 20/);
  const r = await records.saveGrades(db as never, 'c1', 'A1', [{ studentId: 's1', marksObtained: 15 }]);
  assert.equal(r.saved, 1);
  const sub = db.tables.submission[0];
  assert.deepEqual([sub.status, sub.marksObtained], ['GRADED', 15]);
  const m = db.tables.conceptMastery.find((x) => x.studentId === 's1' && x.conceptId === 'k2')!;
  assert.equal(m.masteryScore, 75);                            // 15/20 on Normalization
  const again = await records.saveGrades(db as never, 'c1', 'A1', [{ studentId: 's1', marksObtained: 15 }]);
  assert.deepEqual([again.saved, again.unchanged], [0, 1]);
});

// ------------------------------------------------------------ quiz attempts

test('quiz attempt: graded on the server, responses stored, mastery per concept, not for outsiders', async () => {
  const db = fresh();
  const r = await records.recordQuizAttempt(db as never, 's1', 'Q1', { q1: 'inner join', q2: 'True', q3: 'BCNF' });
  assert.deepEqual([r.score, r.total, r.percentage], [2, 3, 66.7]);
  assert.equal(db.tables.quizResponse.length, 3);
  const mastery = Object.fromEntries(db.tables.conceptMastery.filter((x) => x.studentId === 's1').map((x) => [x.conceptId, x.masteryScore]));
  assert.deepEqual(mastery, { k1: 100, k2: 0 });
  assert.deepEqual(r.tasks.map((t) => t.event), ['quiz_attempted']);
  await assert.rejects(records.recordQuizAttempt(db as never, 'outsider', 'Q1', {}), /Quiz not found/);
});

// ------------------------------------------------------------ submissions

test('submission: on time vs late, and refused once graded', async () => {
  const db = fresh();
  const early = await records.submitAssignment(db as never, 's1', 'A1', { link: 'https://github.com/s1/hw' }, new Date('2026-10-05T00:00:00Z'));
  assert.equal(early.submission.status, 'SUBMITTED');
  const late = await records.submitAssignment(db as never, 's2', 'A1', { content: 'My answer' }, new Date('2026-10-12T00:00:00Z'));
  assert.equal(late.submission.status, 'LATE');
  await records.saveGrades(db as never, 'c1', 'A1', [{ studentId: 's1', marksObtained: 10 }]);
  await assert.rejects(records.submitAssignment(db as never, 's1', 'A1', { content: 'x' }), /already been graded/);
  await assert.rejects(records.submitAssignment(db as never, 'outsider', 'A1', { content: 'x' }), /not found/);
});

// ------------------------------------------------------------ CSV import

test('import: any bad row means nothing is saved, and every problem is reported with its row', async () => {
  const db = fresh();
  const csv = 'rollNumber,date,status\n24BCE0001,2026-10-01,P\n24BCE9999,2026-10-01,P\n24BCE0002,2026-13-01,P\n24BCE0003,2026-10-01,maybe\n';
  await assert.rejects(importCsv(db as never, 'c1', 'attendance', csv), (e: { details: { errors: Array<{ row: number }> } }) => {
    assert.deepEqual(e.details.errors.map((x) => x.row), [3, 4, 5]);
    return true;
  });
  assert.equal(db.tables.attendance.length, 0);
});

test('import: attendance uses the existing lecture for a date, creates one for a new date', async () => {
  const db = fresh();
  const r = await importCsv(db as never, 'c1', 'attendance', 'Roll Number,Date,Status\n24BCE0001,2026-10-01,P\n24BCE0002,2026-10-01,A\n24BCE0001,2026-10-08,L\n');
  assert.deepEqual([r.saved, r.lecturesCreated], [3, 1]);
  assert.equal(db.tables.lecture.length, 2);
  assert.equal(db.tables.attendance.filter((a) => a.lectureId === 'L1').length, 2);
  assert.equal(r.tasks.length, 3);
});

test('import: grades by assignment title; marks validated against that assignment', async () => {
  const db = fresh();
  await assert.rejects(importCsv(db as never, 'c1', 'grades', 'rollNumber,assignment,marks\n24BCE0001,ER Design,25\n24BCE0002,Missing,5\n'), /2 problem/);
  const r = await importCsv(db as never, 'c1', 'grades', 'rollNumber,assignment,marks\n24BCE0001,er design,18\n24BCE0002,ER Design,9\n');
  assert.equal(r.saved, 2);
  assert.deepEqual(db.tables.submission.map((s) => s.marksObtained).sort(), [18, 9]);
});

// ------------------------------------------------------------ end to end: data -> twin

test('END TO END: recording absences updates the twin, risk and alerts with no button press', async () => {
  const db = sharedDb;                                          // the stubbed '@/lib/prisma' the agents use
  for (const k of Object.keys(db.tables)) db.tables[k].length = 0;
  seedCourse(db);
  db.tables.lecture.push(
    { id: 'L2', courseId: 'c1', date: new Date('2026-10-02T00:00:00Z'), time: '10:00', room: 'B-204' },
    { id: 'L3', courseId: 'c1', date: new Date('2026-10-03T00:00:00Z'), time: '10:00', room: 'B-204' },
  );
  const deps = {
    orchestrate: (id: string, ev: Parameters<typeof orchestrate>[1], o: { sourceKey?: string }) => orchestrate(id, ev, o),
    coursesOf: async () => ['c1'],
    refreshInsight: (c: string) => refreshCourseInsight(db as never, c),
  };
  const twinBefore = { ...db.tables.digitalTwin.find((t) => t.studentId === 's1') };

  // Lecture 1: present. Lecture 2 and 3: absent, saved separately within the same hour.
  let report;
  for (const [lecture, status] of [['L1', 'PRESENT'], ['L2', 'ABSENT'], ['L3', 'ABSENT']] as const) {
    const saved = await records.saveAttendance(db as never, 'c1', lecture, [{ studentId: 's1', status }]);
    report = await runTwinSync(saved.tasks, deps);
    assert.equal(report.students[0].status, 'updated', `lecture ${lecture} should trigger a fresh run, not a replay`);
  }

  const twin = db.tables.digitalTwin.find((t) => t.studentId === 's1')!;
  assert.equal(twinBefore.attendanceScore, 100);
  assert.equal(twin.attendanceScore, 33);                      // 1 of 3 lectures attended
  assert.ok(twin.academicHealth < twinBefore.academicHealth);
  assert.ok(twin.lastSyncedAt instanceof Date);
  const risks = db.tables.riskAssessment.filter((r) => r.studentId === 's1');
  assert.equal(risks.length, 3);                               // one per change
  assert.ok(db.tables.alert.some((a) => a.studentId === 's1'), 'an attendance alert was raised');

  // Class insight for the course was recomputed from the new data.
  const insight = db.tables.classInsight.find((i) => i.courseId === 'c1');
  assert.ok(insight, 'class insight written');
  assert.equal(insight.data.courseAttendanceRate, 33.3);
  assert.equal(report!.insightsRefreshed, 1);

  // Twin history: one snapshot per run, and the data-driven dimensions moved with the absences.
  const snaps = db.tables.twinSnapshot.filter((x) => x.studentId === 's1');
  assert.equal(snaps.length, 3, 'one history point per change');
  assert.deepEqual(snaps.map((x) => x.attendanceScore), [100, 50, 33]);
  assert.ok(snaps[2].engagementScore < snaps[0].engagementScore, 'engagement falls as lectures are missed');
  assert.equal(twin.engagementScore, snaps[2].engagementScore, 'history matches the twin');

  // Re-saving identical data changes nothing and runs nothing.
  const same = await records.saveAttendance(db as never, 'c1', 'L3', [{ studentId: 's1', status: 'ABSENT' }]);
  assert.deepEqual([same.saved, same.tasks.length], [0, 0]);
});

test('END TO END: a quiz attempt updates mastery and the knowledge side of the twin', async () => {
  const db = sharedDb;
  for (const k of Object.keys(db.tables)) db.tables[k].length = 0;
  seedCourse(db);
  const deps = {
    orchestrate: (id: string, ev: Parameters<typeof orchestrate>[1], o: { sourceKey?: string }) => orchestrate(id, ev, o) as Promise<OrchestrationResult>,
    coursesOf: async () => ['c1'],
    refreshInsight: (c: string) => refreshCourseInsight(db as never, c),
  };
  const attempt = await records.recordQuizAttempt(db as never, 's2', 'Q1', { q1: 'LEFT JOIN', q2: 'False', q3: 'no idea' });
  assert.equal(attempt.percentage, 0);
  const report = await runTwinSync(attempt.tasks, deps);
  assert.equal(report.students[0].status, 'updated', JSON.stringify(report.students[0]));
  const twin = db.tables.digitalTwin.find((t) => t.studentId === 's2')!;
  assert.equal(twin.knowledgeScore, 0, 'knowledge side of the twin follows the new mastery');
  const mastery = db.tables.conceptMastery.filter((m) => m.studentId === 's2').map((m) => m.masteryScore);
  assert.deepEqual(mastery, [0, 0]);
  const insight = db.tables.classInsight.find((i) => i.courseId === 'c1')!;
  assert.equal(insight.data.weakestConcepts.length, 2);
});

test('submission must contain work; links must be http(s)', () => {
  assert.throws(() => records.checkWork({}), /Add your answer or a link/);
  assert.throws(() => records.checkWork({ link: 'javascript:alert(1)' }), /https/);
  assert.throws(() => records.checkWork({ link: 'not a url' }), /valid web address/);
  assert.deepEqual(records.checkWork({ content: '  my answer ', link: 'https://drive.google.com/x' }), { content: 'my answer', link: 'https://drive.google.com/x' });
});
