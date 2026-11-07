import test from 'node:test';
import './helpers/stub-prisma';
import assert from 'node:assert/strict';
import { buildLearningFeatures } from '../src/lib/agents/learning-features';
import { buildEarlyWarningFeatures } from '../src/lib/agents/early-warning-features';
import { summarizeWork, type AssessedWork } from '../src/lib/agents/assessed-work';

const work = (over: Partial<AssessedWork>): AssessedWork => ({
  quizScoresNewestFirst: [], gradedScoresNewestFirst: [], scoresChronological: [], lateCount: 0, lateHandedInCount: 0, missedCount: 0,
  relativeToClass: null, classAvgPrior: null, nextIsAssignment: 0, lastScoredAt: null, ...over,
});

test('learning features match training: mean of all scores, missing averages filled from it, history features', () => {
  const f = buildLearningFeatures(work({ quizScoresNewestFirst: [80, 60, 40], gradedScoresNewestFirst: [50], scoresChronological: [40, 50, 60, 80], lateCount: 1, missedCount: 2 }))!;
  assert.equal(f.avgMastery, 57.5);
  assert.equal(f.avgQuizScore, 60);
  assert.equal(f.avgSubmissionScore, 50);
  assert.deepEqual([f.quizCount, f.submissionCount, f.quizTrend], [3, 1, 40]);
  assert.deepEqual([f.lastScore, f.scoreTrend, f.lateCount, f.missedCount], [80, 40, 1, 2]);
  assert.ok(Math.abs(f.scoreStd - 14.79) < 0.01);
});

test('no quizzes: quiz average is the overall mean, never 0; no scored work at all: null', () => {
  const f = buildLearningFeatures(work({ gradedScoresNewestFirst: [70, 90], scoresChronological: [90, 70] }))!;
  assert.equal(f.avgQuizScore, 80);
  assert.equal(f.quizCount, 0);
  assert.equal(buildLearningFeatures(work({})), null);
});

test('early-warning features: excused lectures ignored; nothing scored yet is null, not 0', () => {
  const f = buildEarlyWarningFeatures(['PRESENT', 'EXCUSED', 'ABSENT', 'EXCUSED', 'PRESENT', 'LATE'], work({ missedCount: 1, lateHandedInCount: 2 }));
  assert.equal(f.attendanceCount, 4);                 // two excused lectures left out
  assert.equal(f.currentAttendance, 75);              // 3 of 4
  assert.equal(f.recentAttendance, 100);              // PRESENT, LATE
  assert.equal(f.earlyAvgScore, null);
  assert.deepEqual([f.earlyAssessedCount, f.earlyMissedCount, f.earlyLateCount], [0, 1, 2]);
});

test('summarizeWork: late = handed in after due; missed = past due with nothing handed in (drafts do not count)', () => {
  const due = new Date('2026-10-10T23:59:59Z');
  const w = summarizeWork({
    quizzes: [{ percentage: 50, createdAt: new Date('2026-10-01') }, { percentage: 90, createdAt: new Date('2026-10-09') }],
    submissions: [
      { marksObtained: 15, submittedAt: new Date('2026-10-12'), updatedAt: new Date('2026-10-13'), status: 'GRADED', assignment: { maxMarks: 20, dueDate: due } },
      { marksObtained: null, submittedAt: new Date('2026-10-15'), updatedAt: new Date('2026-10-15'), status: 'LATE', assignment: { maxMarks: 20, dueDate: due } },
    ],
    pastDueAssignmentIds: ['a1', 'a2', 'a3'],
    submittedAssignmentIds: ['a1', 'a2'],
  });
  assert.deepEqual(w.quizScoresNewestFirst, [90, 50]);
  assert.deepEqual(w.gradedScoresNewestFirst, [75]);
  assert.deepEqual(w.scoresChronological, [50, 90, 75]);
  assert.deepEqual([w.lateCount, w.lateHandedInCount, w.missedCount], [1, 2, 1]);
});

test('version 6 inputs: class-relative marks, next item type, lecture presence (excused ignored)', () => {
  const w = summarizeWork({
    quizzes: [{ percentage: 80, createdAt: new Date('2026-10-01'), quizId: 'q1' }],
    submissions: [{ marksObtained: 10, submittedAt: new Date('2026-10-05'), updatedAt: new Date('2026-10-06'), status: 'GRADED', assignmentId: 'a1', assignment: { maxMarks: 20, dueDate: new Date('2026-10-10') } }],
    pastDueAssignmentIds: [], submittedAssignmentIds: ['a1'],
    classMeanByQuiz: { q1: 60 }, classMeanByAssignment: { a1: 70 }, hasUpcomingAssignment: true,
  });
  assert.equal(w.relativeToClass, 0);        // +20 on the quiz, -20 on the assignment
  assert.equal(w.classAvgPrior, 65);
  assert.equal(w.nextIsAssignment, 1);
  const f = buildLearningFeatures(w, ['PRESENT', 'ABSENT', 'EXCUSED', 'PRESENT', 'ABSENT', 'ABSENT'])!;
  assert.equal(f.presenceRate, 0.4);          // 2 of 5 counted lectures
  assert.equal(f.recentPresenceRate, 0.25);   // last 4 counted: ABSENT, PRESENT, ABSENT, ABSENT
  assert.equal(f.nextIsExam, 0);
});

test('no class data or attendance: those inputs are null (unknown), never 0', () => {
  const f = buildLearningFeatures(work({ scoresChronological: [60], quizScoresNewestFirst: [60] }))!;
  assert.equal(f.relativeToClass, null);
  assert.equal(f.presenceRate, null);
});

test('fairness inputs: presence vs class on the same lectures, marks vs class; days since last scored work', () => {
  const f = buildEarlyWarningFeatures(['PRESENT', 'ABSENT', 'PRESENT', 'PRESENT'], work({ relativeToClass: -12 }), 90);
  assert.equal(f.presenceVsClass, -15);       // 75% vs the class's 90%
  assert.equal(f.scoreVsClass, -12);
  assert.equal(buildEarlyWarningFeatures([], work({}), 90).presenceVsClass, null);
  const l = buildLearningFeatures(work({ scoresChronological: [60], quizScoresNewestFirst: [60], lastScoredAt: new Date('2026-10-01T00:00:00Z') }), [], new Date('2026-10-15T00:00:00Z'))!;
  assert.equal(l.daysSincePrevious, 14);
  assert.equal(buildLearningFeatures(work({ scoresChronological: [60], quizScoresNewestFirst: [60] }))!.daysSincePrevious, null);
});
