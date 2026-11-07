import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { evaluateKnowledgeGaps } from '../src/lib/twin/knowledge-gap-eval';
import { buildOuladTables, toCsv, type ExportInput } from '../src/lib/twin/oulad-export';

const d = (s: string) => new Date(s);

test('knowledge-gap evaluation: flags that point at real weaknesses are detected as useful', () => {
  const runs = Array.from({ length: 40 }, (_, i) => ({ studentId: `s${i}`, at: d('2026-10-01'), flaggedConceptIds: ['weak'] }));
  const answers = runs.flatMap((r, i) => [
    ...Array.from({ length: 3 }, (_, k) => ({ studentId: r.studentId, conceptId: 'weak', at: d('2026-10-05'), isCorrect: (i + k) % 4 === 0 })),   // 25% right
    ...Array.from({ length: 3 }, (_, k) => ({ studentId: r.studentId, conceptId: 'fine', at: d('2026-10-05'), isCorrect: (i + k) % 4 !== 0 })),   // 75% right
  ]);
  const r = evaluateKnowledgeGaps(runs, answers);
  assert.equal(r.answersEvaluated, 240);
  assert.ok(r.riskRatio! > 2.5);
  assert.match(r.verdict, /^useful/);
});

test('knowledge-gap evaluation: answers before any run, or beyond the horizon, are not counted; small data says so', () => {
  const runs = [{ studentId: 's1', at: d('2026-10-10'), flaggedConceptIds: ['c'] }];
  const answers = [
    { studentId: 's1', conceptId: 'c', at: d('2026-10-05'), isCorrect: false },   // before the run
    { studentId: 's1', conceptId: 'c', at: d('2026-12-30'), isCorrect: false },   // beyond 30 days
    { studentId: 's1', conceptId: 'c', at: d('2026-10-12'), isCorrect: false },
  ];
  const r = evaluateKnowledgeGaps(runs, answers);
  assert.equal(r.answersEvaluated, 1);
  assert.match(r.verdict, /not enough data/);
});

function fakeApp(): ExportInput {
  const courses = [0, 1, 2].map((i) => ({ id: `c${i}`, code: `CS10${i}`, semester: i + 1, createdAt: d('2026-07-01') }));
  const lectures = courses.flatMap((c) => Array.from({ length: 10 }, (_, w) => ({ id: `${c.id}L${w}`, courseId: c.id, date: new Date(Date.UTC(2026, 7, 1 + 7 * w)) })));
  const students = Array.from({ length: 60 }, (_, i) => ({ id: `st${i}`, rollNumber: `24BCE${String(i).padStart(4, '0')}` }));
  const enrollments = courses.flatMap((c) => students.map((s) => ({ studentId: s.id, courseId: c.id, enrolledAt: d('2026-07-25') })));
  const quizzes = courses.flatMap((c) => [1, 3, 5].map((w) => ({ id: `${c.id}Q${w}`, courseId: c.id, createdAt: new Date(Date.UTC(2026, 7, 1 + 7 * w)) })));
  const assignments = courses.flatMap((c) => [2, 4, 6].map((w) => ({ id: `${c.id}A${w}`, courseId: c.id, dueDate: new Date(Date.UTC(2026, 7, 2 + 7 * w)) })));
  const good = (s: string) => Number(s.slice(2)) % 3 !== 0;
  const attempts = quizzes.flatMap((q) => students.map((s) => ({ studentId: s.id, quizId: q.id, percentage: good(s.id) ? 75 : 40, createdAt: new Date(q.createdAt.getTime() + 86_400_000) })));
  const submissions = assignments.flatMap((a) => students.map((s) => ({ studentId: s.id, assignmentId: a.id, marksObtained: good(s.id) ? 16 : 8, maxMarks: 20, submittedAt: new Date(a.dueDate.getTime() - (good(s.id) ? 86_400_000 : -2 * 86_400_000)), updatedAt: a.dueDate })));
  const attendance = lectures.flatMap((l) => students.map((s, i) => ({ studentId: s.id, lectureId: l.id, status: good(s.id) || i % 2 ? 'PRESENT' : 'ABSENT' })));
  const outcomes = courses.flatMap((c) => students.map((s) => ({ rollNumber: s.rollNumber, courseCode: c.code, result: good(s.id) ? 'Pass' : 'Fail' })));
  return { courses, lectures, enrollments, students, quizzes, assignments, attempts, submissions, attendance, outcomes };
}

test('export: OULAD tables with the right types, days from course start, and only students with a result', () => {
  const input = fakeApp();
  input.outcomes = input.outcomes.filter((o) => o.rollNumber !== '24BCE0000');
  const t = buildOuladTables(input);
  assert.equal(t.studentInfo.length, 3 * 59);
  assert.ok(!t.studentAssessment.some((r) => r.id_student === 'st0'), 'students without a result are left out');
  const q = t.assessments.find((a) => a.id_assessment === 'c0Q1')!;
  assert.deepEqual([q.assessment_type, q.date], ['CMA', 7]);
  assert.equal(t.assessments.find((a) => a.id_assessment === 'c0A2')!.assessment_type, 'TMA');
  assert.ok(t.studentVle.every((r) => r.sum_click === 1));
  assert.match(toCsv([{ a: 'x,y' }], ['a']), /"x,y"/);
});

test('export round trip: the Python training code reads the exported files and builds training rows', () => {
  const t = buildOuladTables(fakeApp());
  const dir = mkdtempSync(join(tmpdir(), 'oulad-'));
  const cols: Record<string, string[]> = {
    studentInfo: ['code_module', 'code_presentation', 'id_student', 'final_result'],
    assessments: ['code_module', 'code_presentation', 'id_assessment', 'assessment_type', 'date', 'weight'],
    studentAssessment: ['id_assessment', 'id_student', 'date_submitted', 'is_banked', 'score'],
    studentVle: ['code_module', 'code_presentation', 'id_student', 'id_site', 'date', 'sum_click'],
    studentRegistration: ['code_module', 'code_presentation', 'id_student', 'date_registration', 'date_unregistration'],
  };
  for (const [name, rows] of Object.entries(t)) writeFileSync(join(dir, `${name}.csv`), toCsv(rows as never, cols[name]));
  try {
    const py = `
import sys, pandas as pd
sys.path.insert(0, 'ml')
import oulad_features as F
D = sys.argv[1]
info = pd.read_csv(f'{D}/studentInfo.csv', na_values=['?']); sa = pd.read_csv(f'{D}/studentAssessment.csv', na_values=['?'])
a = pd.read_csv(f'{D}/assessments.csv', na_values=['?']); vle = pd.read_csv(f'{D}/studentVle.csv'); reg = pd.read_csv(f'{D}/studentRegistration.csv', na_values=['?'])
weeks = F.vle_weeks(vle)
L = F.build_learning_frame(sa, a, target='next', weeks_by_key=weeks)
A = F.build_attendance_frame(info, weeks, reg, history=F.assessment_history(sa, a))
print(len(L), len(A), A['target'].nunique(), int(L['presenceRate'].notna().sum() > 0))`;
    const out = execFileSync('python3', ['-c', py, dir], { encoding: 'utf8' }).trim().split(/\s+/).map(Number);
    assert.ok(out[0] > 500, `learning rows ${out[0]}`);
    assert.equal(out[1], 180);
    assert.equal(out[2], 2, 'both outcomes present');
    assert.equal(out[3], 1, 'attendance became activity');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
