import test from 'node:test';
import './helpers/stub-prisma';
import assert from 'node:assert/strict';
import { nextMastery, observedByConcept } from '../src/lib/twin/mastery';
import { summarizeCourse } from '../src/lib/twin/class-insights';
import { parseCsv, requireHeaders } from '../src/lib/twin/csv';
import { parseIsoDate, parseStatus } from '../src/lib/twin/import';
import { gradeQuiz, RecordError } from '../src/lib/twin/records';
import { mergeTasks, runTwinSync, type SyncDeps } from '../src/lib/twin/sync';
import { displayQuestion, questionOptions } from '../src/lib/twin/quiz';
import type { OrchestrationResult } from '../src/lib/agents/types';

// ------------------------------------------------------------ mastery

test('mastery: the first assessment sets the score; later ones move it with decreasing weight', () => {
  const first = nextMastery(null, 80);
  assert.deepEqual([first.masteryScore, first.assessmentCount, first.trend], [80, 1, 'STABLE']);
  const second = nextMastery(first, 40);                       // weight 1/2
  assert.deepEqual([second.masteryScore, second.previousScore, second.trend], [60, 80, 'DOWN']);
  let state = { masteryScore: 50, assessmentCount: 10 };       // weight floor 0.25
  const later = nextMastery(state, 90);
  assert.equal(later.masteryScore, 60);
  assert.equal(later.trend, 'UP');
  assert.ok(later.confidenceLevel <= 0.95);
  state = { masteryScore: 50, assessmentCount: 3 };
  assert.equal(nextMastery(state, 51).trend, 'STABLE');        // moved < 2 points
});

test('mastery: observed scores are clamped to 0-100 and computed per concept', () => {
  assert.equal(nextMastery(null, 140).masteryScore, 100);
  assert.deepEqual(observedByConcept([
    { conceptId: 'a', isCorrect: true }, { conceptId: 'a', isCorrect: false }, { conceptId: 'b', isCorrect: true },
  ]), { a: 50, b: 100 });
});

// ------------------------------------------------------------ class insights

test('class insight: averages only real data; unassessed students are counted, not invented', () => {
  const summary = summarizeCourse(
    [
      { twin: { academicHealth: 80, attendanceScore: 90, knowledgeScore: 60, performanceScore: 70 }, latestRiskLevel: 'LOW', attendanceStatuses: ['PRESENT', 'ABSENT'] },
      { twin: { academicHealth: 40, attendanceScore: 50, knowledgeScore: 30, performanceScore: 45 }, latestRiskLevel: 'HIGH', attendanceStatuses: ['LATE', 'ABSENT'] },
      { twin: null, latestRiskLevel: null, attendanceStatuses: [] },
    ],
    [
      { id: 'k1', name: 'Joins', scores: [40, 60] },
      { id: 'k2', name: 'Keys', scores: [90] },
      { id: 'k3', name: 'Never assessed', scores: [] },
    ],
    2,
    new Date('2026-10-17T00:00:00Z')
  );
  assert.equal(summary.studentCount, 3);
  assert.equal(summary.studentsWithTwin, 2);
  assert.deepEqual(summary.averages, { academicHealth: 60, knowledge: 45, performance: 57.5 });
  assert.equal(summary.courseAttendanceRate, 50);
  assert.deepEqual(summary.riskDistribution, { LOW: 1, MEDIUM: 0, HIGH: 1, CRITICAL: 0, NOT_ASSESSED: 1 });
  assert.equal(summary.atRiskCount, 1);
  assert.deepEqual(summary.weakestConcepts.map((c) => [c.name, c.averageMastery, c.studentsBelow70]), [['Joins', 50, 2], ['Keys', 90, 0]]);
});

test('class insight: an empty course gives nulls, not zeros', () => {
  const s = summarizeCourse([], [], 0);
  assert.deepEqual(s.averages, { academicHealth: null, knowledge: null, performance: null });
  assert.equal(s.courseAttendanceRate, null);
});

// ------------------------------------------------------------ CSV

test('csv: quotes, escaped quotes, CRLF, BOM, blank lines and header normalisation', () => {
  const t = parseCsv('\uFEFFRoll Number,Date,Status\r\n24BCE0001,2026-10-01,P\r\n\r\n"24BCE0002","2026-10-01","say ""hi"", ok"\n');
  assert.deepEqual(t.headers, ['rollnumber', 'date', 'status']);
  assert.equal(t.rows.length, 2);
  assert.equal(t.rows[1].status, 'say "hi", ok');
  assert.throws(() => requireHeaders(t, ['rollNumber', 'marks']), /Missing column\(s\): marks/);
  assert.throws(() => parseCsv('a,b\n"open'), /not closed/);
  assert.throws(() => parseCsv(''), /empty/);
});

test('import helpers: statuses accept full names and P/A/L/E; dates must be real YYYY-MM-DD', () => {
  assert.equal(parseStatus('p'), 'PRESENT');
  assert.equal(parseStatus('Excused'), 'EXCUSED');
  assert.equal(parseStatus('here'), null);
  assert.ok(parseIsoDate('2026-02-28'));
  assert.equal(parseIsoDate('2026-02-30'), null);
  assert.equal(parseIsoDate('01/02/2026'), null);
});

// ------------------------------------------------------------ quiz grading

test('quiz grading: case and spacing do not matter; blanks are wrong; unknown questions rejected', () => {
  const qs = [
    { id: 'q1', conceptId: 'k1', correctAnswer: 'INNER JOIN' },
    { id: 'q2', conceptId: 'k1', correctAnswer: 'True' },
    { id: 'q3', conceptId: 'k2', correctAnswer: 'Third normal form' },
  ];
  const graded = gradeQuiz(qs, { q1: '  inner   join ', q2: 'False' });
  assert.deepEqual(graded.map((g) => g.isCorrect), [true, false, false]);
  assert.equal(graded[2].studentAnswer, '');
  assert.throws(() => gradeQuiz(qs, { nope: 'x' }), RecordError);
});

test('question display: new {prompt, choices} and old bare-array options both render', () => {
  assert.deepEqual(displayQuestion({ prompt: 'Which join?', choices: ['INNER', 'LEFT'] }, 'MCQ', 'Joins', 0), { prompt: 'Which join?', choices: ['INNER', 'LEFT'] });
  assert.deepEqual(displayQuestion(['A', 'B'], 'MCQ', 'Joins', 2), { prompt: 'Question 3 (Joins)', choices: ['A', 'B'] });
  assert.deepEqual(questionOptions({ type: 'TRUE_FALSE', prompt: 'p', choices: ['x'] }).choices, ['True', 'False']);
});

// ------------------------------------------------------------ sync engine

const result = (over: Partial<OrchestrationResult> = {}): OrchestrationResult =>
  ({ results: [], intervention: {} as never, executedAt: new Date(), ...over });

test('sync: one run per student and event; several changes share one combined key', () => {
  const merged = mergeTasks([
    { studentId: 's1', event: 'attendance_marked', sourceKey: 'b' },
    { studentId: 's1', event: 'attendance_marked', sourceKey: 'a' },
    { studentId: 's2', event: 'attendance_marked', sourceKey: 'c' },
    { studentId: 's1', event: 'quiz_attempted', sourceKey: 'q' },
  ]);
  assert.equal(merged.length, 3);
  const s1 = merged.find((t) => t.studentId === 's1' && t.event === 'attendance_marked')!;
  assert.match(s1.sourceKey!, /^batch:[0-9a-f]{32}$/);
  const again = mergeTasks([{ studentId: 's1', event: 'attendance_marked', sourceKey: 'a' }, { studentId: 's1', event: 'attendance_marked', sourceKey: 'b' }]);
  assert.equal(again[0].sourceKey, s1.sourceKey);                // order does not matter
});

test('sync: reports each outcome, isolates failures, refreshes every affected course', async () => {
  const calls: string[] = [];
  const refreshSkipFlags: Array<boolean | undefined> = [];
  const refreshed: string[] = [];
  const deps: SyncDeps = {
    orchestrate: async (studentId, event, options) => {
      calls.push(`${studentId}:${event}:${options.sourceKey}`);
      refreshSkipFlags.push(options.skipCourseInsightRefresh);
      if (studentId === 'boom') throw new Error('db down');
      if (studentId === 'deg') return result({ degraded: true, agentErrors: [{ agent: 'attendance', message: 'ML down' }] });
      if (studentId === 'rep') return result({ replayed: true });
      return result();
    },
    coursesOf: async (ids) => (ids.length ? ['c1', 'c2'] : []),
    refreshInsight: async (courseId) => { refreshed.push(courseId); },
  };
  const warn = console.warn; console.warn = () => {};
  const report = await runTwinSync(['ok', 'deg', 'rep', 'boom'].map((s) => ({ studentId: s, event: 'attendance_marked' as const, sourceKey: `k-${s}` })), deps);
  console.warn = warn;
  const status = Object.fromEntries(report.students.map((r) => [r.studentId, r.status]));
  assert.deepEqual(status, { ok: 'updated', deg: 'degraded', rep: 'replayed', boom: 'failed' });
  assert.match(report.students.find((r) => r.studentId === 'deg')!.detail!, /ML down/);
  assert.equal(calls.length, 4);
  assert.deepEqual(refreshSkipFlags, [true, true, true, true]);
  assert.deepEqual(refreshed, ['c1', 'c2']);
  assert.equal(report.insightsRefreshed, 2);
});
