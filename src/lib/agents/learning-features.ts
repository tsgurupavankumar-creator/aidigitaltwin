/**
 * The learning model's input, built as ml/oulad_features.py builds it for
 * training, so the model sees the same quantities live as it learned on.
 *
 *   avgMastery          mean of all the student's scored work so far
 *   avgQuizScore        mean of the latest 10 quiz percentages
 *   avgSubmissionScore  mean of the latest 20 graded assignment percentages
 *                       (either average, when missing, is filled with avgMastery,
 *                       as in training; never with 0, which would read as "scored zero")
 *   quizCount, submissionCount, quizTrend (newest minus oldest quiz)
 *   lastScore           most recent scored work
 *   scoreTrend          most recent minus earliest scored work
 *   scoreStd            spread of all scored work
 *   lateCount           graded assignments handed in after their due date
 *   missedCount         assignments past due with nothing handed in
 *   nextIsAssignment    1 when an assignment is due next, else 0 (a quiz); nextIsExam is 0 (no exams in the app)
 *   relativeToClass     student's marks minus the class average on the same items
 *   classAvgPrior       the class average on those items
 *   presenceRate, recentPresenceRate  lecture attendance overall and over the last 4 lectures
 *                       (training: weeks with online activity, overall and last 4 weeks)
 *
 * Returns null when the student has no scored work at all (training needed at
 * least one earlier score); the orchestrator then skips this model.
 */
import type { AssessedWork } from './assessed-work';
import type { AttendanceStatusValue } from './early-warning-features';

export interface LearningFeatures {
  avgMastery: number;
  avgQuizScore: number;
  avgSubmissionScore: number;
  quizCount: number;
  submissionCount: number;
  quizTrend: number;
  lastScore: number;
  scoreTrend: number;
  scoreStd: number;
  lateCount: number;
  missedCount: number;
  nextIsAssignment: number;
  nextIsExam: number;
  relativeToClass: number | null;
  classAvgPrior: number | null;
  presenceRate: number | null;
  recentPresenceRate: number | null;
  daysSincePrevious: number | null;
}

const RECENT_LECTURES = 4;   // stands in for training's "last 4 weeks"

/** Share of lectures attended (EXCUSED left out), overall and over the last 4; null when none recorded. */
export function presence(statuses: AttendanceStatusValue[]) {
  const counted = statuses.filter((s) => s !== 'EXCUSED');
  const rate = (list: AttendanceStatusValue[]) => list.filter((s) => s === 'PRESENT' || s === 'LATE').length / list.length;
  return {
    presenceRate: counted.length ? rate(counted) : null,
    recentPresenceRate: counted.length ? rate(counted.slice(-RECENT_LECTURES)) : null,
  };
}

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const std = (v: number[]) => { const m = mean(v); return Math.sqrt(mean(v.map((x) => (x - m) ** 2))); };

/** statuses: the student's attendance, oldest first. */
export function buildLearningFeatures(work: AssessedWork, statuses: AttendanceStatusValue[] = [], now = new Date()): LearningFeatures | null {
  const quizzes = work.quizScoresNewestFirst.slice(0, 10);
  const graded = work.gradedScoresNewestFirst.slice(0, 20);
  const all = work.scoresChronological;
  if (!all.length) return null;
  const avgMastery = mean(all);
  return {
    avgMastery,
    avgQuizScore: quizzes.length ? mean(quizzes) : avgMastery,
    avgSubmissionScore: graded.length ? mean(graded) : avgMastery,
    quizCount: quizzes.length,
    submissionCount: graded.length,
    quizTrend: quizzes.length > 1 ? quizzes[0] - quizzes[quizzes.length - 1] : 0,
    lastScore: all[all.length - 1],
    scoreTrend: all.length > 1 ? all[all.length - 1] - all[0] : 0,
    scoreStd: std(all),
    lateCount: work.lateCount,
    missedCount: work.missedCount,
    nextIsAssignment: work.nextIsAssignment,
    nextIsExam: 0,
    relativeToClass: work.relativeToClass,
    classAvgPrior: work.classAvgPrior,
    ...presence(statuses),
    // training: days between the previous scored assessment and the predicted one; live: since the last scored work
    daysSincePrevious: work.lastScoredAt ? Math.max(0, (now.getTime() - work.lastScoredAt.getTime()) / 86_400_000) : null,
  };
}
