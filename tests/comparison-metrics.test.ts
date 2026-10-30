import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildComparisonReport, confusion, evaluateStudent, summarize,
  type AttendanceStatus, type RiskLevelName, type StudentEvidence,
} from '../scripts/lib/comparison-metrics';

const day = (n: number) => new Date(Date.UTC(2026, 0, n));
const empty = (over: Partial<StudentEvidence> = {}): StudentEvidence => ({
  studentId: 's', attendance: [], quizAttempts: [], pastDueAssignments: [], riskAssessments: [], masteryScores: [], ...over,
});
const att = (pattern: string, startDay = 1) =>
  [...pattern].map((c, i) => ({ status: (c === 'P' ? 'PRESENT' : 'ABSENT') as AttendanceStatus, createdAt: day(startDay + i) }));
const risk = (...levels: Array<[RiskLevelName, number]>) => levels.map(([riskLevel, d]) => ({ riskLevel, createdAt: day(d) }));

test('attendance rule: flagged when the current rate is below 75%, dated at the start of the CURRENT streak', () => {
  // P P P A A A A -> running 100,100,100,75,60,50,42.9 ; below 75 from the 5th record (day 5)
  const e = evaluateStudent(empty({ attendance: att('PPPAAAA') }));
  assert.equal(e.ruleFlags, true);
  assert.equal(e.ruleFlagDate?.getTime(), day(5).getTime());
});

test('attendance rule: a student who dipped and RECOVERED is not flagged', () => {
  assert.equal(evaluateStudent(empty({ attendance: att('PAAPPPPPPP') })).ruleFlags, false); // ends at 80%
});

test('attendance rule: exactly 75% is not flagged, and no records means not flagged', () => {
  assert.equal(evaluateStudent(empty({ attendance: att('PPPA') })).ruleFlags, false);
  assert.equal(evaluateStudent(empty()).ruleFlags, false);
});

test('LATE counts as present', () => {
  const records = [{ status: 'LATE' as AttendanceStatus, createdAt: day(1) }, { status: 'LATE' as AttendanceStatus, createdAt: day(2) }];
  assert.equal(evaluateStudent(empty({ attendance: records })).ruleFlags, false);
});

test('quiz rule: last quiz < 50 flags; dated at the first quiz of the consecutive low run', () => {
  const e = evaluateStudent(empty({ quizAttempts: [
    { percentage: 80, createdAt: day(1) }, { percentage: 40, createdAt: day(2) }, { percentage: 30, createdAt: day(3) },
  ] }));
  assert.equal(e.ruleFlags, true);
  assert.equal(e.ruleFlagDate?.getTime(), day(2).getTime());
});

test('quiz rule: a low quiz followed by a good one is not flagged (only the LAST quiz counts)', () => {
  const e = evaluateStudent(empty({ quizAttempts: [{ percentage: 30, createdAt: day(1) }, { percentage: 70, createdAt: day(2) }] }));
  assert.equal(e.ruleFlags, false);
});

test('missed assignments: needs 2; dated at the 2nd missed due date; submitted ones do not count', () => {
  const one = evaluateStudent(empty({ pastDueAssignments: [
    { dueDate: day(3), hasSubmission: false }, { dueDate: day(5), hasSubmission: true },
  ] }));
  assert.equal(one.ruleFlags, false);
  const two = evaluateStudent(empty({ pastDueAssignments: [
    { dueDate: day(9), hasSubmission: false }, { dueDate: day(3), hasSubmission: false }, { dueDate: day(6), hasSubmission: true },
  ] }));
  assert.equal(two.ruleFlags, true);
  assert.equal(two.ruleFlagDate?.getTime(), day(9).getTime()); // sorted by due date: day 3, then day 9
});

test('rule flag date is the EARLIEST of the triggered conditions', () => {
  const e = evaluateStudent(empty({
    attendance: att('PPPAAAA'),                                              // streak starts day 5
    quizAttempts: [{ percentage: 20, createdAt: day(2) }],                  // day 2
  }));
  assert.equal(e.ruleFlagDate?.getTime(), day(2).getTime());
});

test('AI flag uses the LATEST assessment and the start of its current HIGH/CRITICAL streak', () => {
  assert.equal(evaluateStudent(empty({ riskAssessments: risk(['LOW', 1], ['HIGH', 2], ['CRITICAL', 3]) })).aiFlagDate?.getTime(), day(2).getTime());
  assert.equal(evaluateStudent(empty({ riskAssessments: risk(['HIGH', 1], ['LOW', 2]) })).aiFlags, false);   // recovered
  assert.equal(evaluateStudent(empty({ riskAssessments: risk(['HIGH', 1], ['LOW', 2], ['HIGH', 3]) })).aiFlagDate?.getTime(), day(3).getTime());
  assert.equal(evaluateStudent(empty({ riskAssessments: risk(['MEDIUM', 1]) })).aiFlags, false);
});

test('assessments are ordered by time, not by array position', () => {
  const e = evaluateStudent(empty({ riskAssessments: risk(['CRITICAL', 3], ['LOW', 1], ['HIGH', 2]) }));
  assert.equal(e.aiFlags, true);
  assert.equal(e.aiFlagDate?.getTime(), day(2).getTime());
});

test('ground-truth proxy: avg mastery < 70 is struggling; NO mastery data means no ground truth (null)', () => {
  assert.equal(evaluateStudent(empty({ masteryScores: [60, 70] })).actuallyStruggling, true);   // 65
  assert.equal(evaluateStudent(empty({ masteryScores: [70, 80] })).actuallyStruggling, false);
  assert.equal(evaluateStudent(empty()).actuallyStruggling, null);
});

test('confusion + precision/recall/FPR match a hand-computed example', () => {
  // flags: T T F F ; truth: T F T F  ->  TP=1 FP=1 FN=1 TN=1
  const s = summarize(confusion([true, true, false, false], [true, false, true, false]));
  assert.deepEqual([s.precision, s.recall, s.false_positive_rate], [0.5, 0.5, 0.5]);
});

test('undefined ratios are null, never 0 or invented', () => {
  const s = summarize(confusion([false, false], [false, false]));  // nothing flagged, nothing struggling
  assert.equal(s.precision, null);
  assert.equal(s.recall, null);
  assert.equal(s.false_positive_rate, 0);                          // 0 FP out of 2 real negatives is a genuine 0
});

test('report: excludes students without ground truth and says so; early detection sign and units are right', () => {
  const evals = [
    // flagged by both; rule flagged on day 20, AI on day 10 -> AI earlier by 10 days
    { studentId: 'a', ruleFlags: true, ruleFlagDate: day(20), aiFlags: true, aiFlagDate: day(10), avgMastery: 50, actuallyStruggling: true },
    // no ground truth -> excluded
    { studentId: 'b', ruleFlags: true, ruleFlagDate: day(5), aiFlags: true, aiFlagDate: day(5), avgMastery: null, actuallyStruggling: null },
    // healthy, not flagged
    { studentId: 'c', ruleFlags: false, ruleFlagDate: null, aiFlags: false, aiFlagDate: null, avgMastery: 90, actuallyStruggling: false },
  ];
  const r = buildComparisonReport(evals, day(30));
  assert.equal(r.sample_size, 3);
  assert.equal(r.evaluated, 2);
  assert.equal(r.excluded_no_ground_truth, 1);
  assert.equal(r.metrics.early_detection_days, 10);
  assert.equal(r.metrics.early_detection_weeks, 1.43);
  assert.equal(r.metrics.early_detection_sample_size, 1);
  assert.equal(r.metrics.ai_twin.precision, 1);
  assert.equal(r.metrics.traditional.recall, 1);
});

test('report: with nobody flagged by both, early detection is null with an explanation (not a number)', () => {
  const r = buildComparisonReport([
    { studentId: 'a', ruleFlags: true, ruleFlagDate: day(2), aiFlags: false, aiFlagDate: null, avgMastery: 40, actuallyStruggling: true },
  ]);
  assert.equal(r.metrics.early_detection_days, null);
  assert.equal(r.metrics.early_detection_weeks, null);
  assert.match(r.metrics.early_detection_note, /cannot be computed/);
});

test('report: unmeasured metrics are null with reasons, and the circularity caveat is present', () => {
  const r = buildComparisonReport([]);
  assert.equal(r.unmeasured_metrics.personalization_depth.value, null);
  assert.equal(r.unmeasured_metrics.intervention_usefulness_score.value, null);
  assert.ok(r.unmeasured_metrics.personalization_depth.reason.length > 20);
  assert.ok(r.caveats.some((c) => c.startsWith('CIRCULARITY')));
});
