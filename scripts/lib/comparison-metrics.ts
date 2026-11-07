/**
 * Pure comparison logic: AI Digital Twin vs. a rule-based "traditional dashboard".
 * No database access here, so it is unit-tested with hand-computed cases
 * (tests/comparison-metrics.test.ts). scripts/generate-comparison-report.ts
 * loads the data and calls into this module.
 *
 * Nothing in the report is invented: every number is computed from evidence
 * passed in, and anything that cannot be measured is null with a reason.
 *
 * ── Definitions ─────────────────────────────────────────────────────────
 * Both systems are judged on the student's CURRENT state.
 *
 * TRADITIONAL BASELINE flags a student if ANY of:
 *   - current attendance rate < 75%
 *   - most recent quiz percentage < 50%
 *   - 2 or more missed assignments (past-due assignment in an enrolled course
 *     with no Submission row at all; a DRAFT submission is not "missed")
 *
 * AI TWIN flags a student if their MOST RECENT RiskAssessment is HIGH/CRITICAL.
 *
 * GROUND-TRUTH PROXY (not a real outcome label): average ConceptMastery
 * score < 70. The schema has no failed/withdrawn/struggling field. Students
 * with no mastery records have NO ground truth and are EXCLUDED from precision
 * and recall (they are counted and reported, not silently treated as "fine").
 *
 * EARLY DETECTION: for students currently flagged by both systems, days between
 * when the rule's CURRENT flagged streak began and when the AI's CURRENT flagged
 * streak began. Positive = the AI flagged earlier.
 *
 * KNOWN LIMIT — CIRCULARITY: the AI's risk score includes a knowledge-gap
 * component computed from the same ConceptMastery data as the ground-truth
 * proxy, so the AI is partly graded against its own input. This favours the AI
 * twin. The baseline rules never use mastery. Read the result as a methodology
 * demonstration, not as proof of superiority.
 */

export const MASTERY_STRUGGLING_THRESHOLD = 70;
export const RULE_ATTENDANCE_THRESHOLD = 75;
export const RULE_QUIZ_THRESHOLD = 50;
export const RULE_MISSED_ASSIGNMENTS_THRESHOLD = 2;

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
export type RiskLevelName = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface StudentEvidence {
  studentId: string;
  attendance: Array<{ status: AttendanceStatus; createdAt: Date }>;
  quizAttempts: Array<{ percentage: number; createdAt: Date }>;
  /** Assignments already past due in courses the student is enrolled in. */
  pastDueAssignments: Array<{ dueDate: Date; hasSubmission: boolean }>;
  riskAssessments: Array<{ riskLevel: RiskLevelName; createdAt: Date }>;
  masteryScores: number[];
}

export interface StudentEvaluation {
  studentId: string;
  ruleFlags: boolean;
  ruleFlagDate: Date | null;
  aiFlags: boolean;
  aiFlagDate: Date | null;
  avgMastery: number | null;
  /** Null when there is no ground truth for this student. */
  actuallyStruggling: boolean | null;
}

const byTime = <T extends { createdAt: Date }>(a: T, b: T) => a.createdAt.getTime() - b.createdAt.getTime();
const isPresent = (status: AttendanceStatus) => status === 'PRESENT' || status === 'LATE';

export function evaluateStudent(evidence: StudentEvidence): StudentEvaluation {
  // ── Traditional: attendance ──────────────────────────────────────────
  const attendance = [...evidence.attendance].sort(byTime);
  let present = 0;
  const runningRate = attendance.map((record, index) => {
    if (isPresent(record.status)) present += 1;
    return (present / (index + 1)) * 100;
  });
  const currentRate = runningRate.length ? runningRate[runningRate.length - 1] : 100;
  const attendanceFlags = currentRate < RULE_ATTENDANCE_THRESHOLD;
  let attendanceFlagDate: Date | null = null;
  if (attendanceFlags) {
    let i = runningRate.length - 1;
    while (i >= 0 && runningRate[i] < RULE_ATTENDANCE_THRESHOLD) i -= 1;
    attendanceFlagDate = attendance[i + 1].createdAt; // start of the current below-threshold streak
  }

  // ── Traditional: most recent quiz ───────────────────────────────────
  const quizzes = [...evidence.quizAttempts].sort(byTime);
  const lastQuiz = quizzes[quizzes.length - 1];
  const quizFlags = lastQuiz !== undefined && lastQuiz.percentage < RULE_QUIZ_THRESHOLD;
  let quizFlagDate: Date | null = null;
  if (quizFlags) {
    let i = quizzes.length - 1;
    while (i >= 0 && quizzes[i].percentage < RULE_QUIZ_THRESHOLD) i -= 1;
    quizFlagDate = quizzes[i + 1].createdAt;
  }

  // ── Traditional: missed assignments ─────────────────────────────────
  const missed = evidence.pastDueAssignments
    .filter((a) => !a.hasSubmission)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const missedFlags = missed.length >= RULE_MISSED_ASSIGNMENTS_THRESHOLD;
  const missedFlagDate = missedFlags ? missed[RULE_MISSED_ASSIGNMENTS_THRESHOLD - 1].dueDate : null;

  const ruleFlags = attendanceFlags || quizFlags || missedFlags;
  const ruleDates = [attendanceFlagDate, quizFlagDate, missedFlagDate].filter((d): d is Date => d !== null);
  const ruleFlagDate = ruleDates.length ? new Date(Math.min(...ruleDates.map((d) => d.getTime()))) : null;

  // ── AI twin: latest assessment, and when its current streak began ───
  const assessments = [...evidence.riskAssessments].sort(byTime);
  const isHigh = (level: RiskLevelName) => level === 'HIGH' || level === 'CRITICAL';
  const latest = assessments[assessments.length - 1];
  const aiFlags = latest !== undefined && isHigh(latest.riskLevel);
  let aiFlagDate: Date | null = null;
  if (aiFlags) {
    let i = assessments.length - 1;
    while (i >= 0 && isHigh(assessments[i].riskLevel)) i -= 1;
    aiFlagDate = assessments[i + 1].createdAt;
  }

  // ── Ground-truth proxy ──────────────────────────────────────────────
  const avgMastery = evidence.masteryScores.length
    ? evidence.masteryScores.reduce((sum, v) => sum + v, 0) / evidence.masteryScores.length
    : null;

  return {
    studentId: evidence.studentId,
    ruleFlags,
    ruleFlagDate,
    aiFlags,
    aiFlagDate,
    avgMastery,
    actuallyStruggling: avgMastery === null ? null : avgMastery < MASTERY_STRUGGLING_THRESHOLD,
  };
}

export interface ConfusionCounts {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
}

export function confusion(flags: boolean[], truth: boolean[]): ConfusionCounts {
  const c: ConfusionCounts = { truePositives: 0, falsePositives: 0, falseNegatives: 0, trueNegatives: 0 };
  flags.forEach((flag, i) => {
    if (flag && truth[i]) c.truePositives += 1;
    else if (flag && !truth[i]) c.falsePositives += 1;
    else if (!flag && truth[i]) c.falseNegatives += 1;
    else c.trueNegatives += 1;
  });
  return c;
}

const ratio = (num: number, den: number): number | null => (den > 0 ? Number((num / den).toFixed(4)) : null);

export function summarize(c: ConfusionCounts) {
  return {
    precision: ratio(c.truePositives, c.truePositives + c.falsePositives),
    recall: ratio(c.truePositives, c.truePositives + c.falseNegatives),
    false_positive_rate: ratio(c.falsePositives, c.falsePositives + c.trueNegatives),
    true_positives: c.truePositives,
    false_positives: c.falsePositives,
    false_negatives: c.falseNegatives,
    true_negatives: c.trueNegatives,
  };
}

const DAY_MS = 1000 * 60 * 60 * 24;

export function buildComparisonReport(evaluations: StudentEvaluation[], generatedAt: Date = new Date()) {
  const evaluable = evaluations.filter(
    (e): e is StudentEvaluation & { actuallyStruggling: boolean } => e.actuallyStruggling !== null
  );
  const excluded = evaluations.length - evaluable.length;

  const truth = evaluable.map((e) => e.actuallyStruggling);
  const traditional = summarize(confusion(evaluable.map((e) => e.ruleFlags), truth));
  const aiTwin = summarize(confusion(evaluable.map((e) => e.aiFlags), truth));

  const both = evaluable.filter((e) => e.ruleFlags && e.aiFlags && e.ruleFlagDate && e.aiFlagDate);
  const earlyDays = both.map((e) => (e.ruleFlagDate!.getTime() - e.aiFlagDate!.getTime()) / DAY_MS);
  const avgEarlyDays = earlyDays.length ? earlyDays.reduce((s, d) => s + d, 0) / earlyDays.length : null;

  return {
    generated_at: generatedAt.toISOString(),
    sample_size: evaluations.length,
    evaluated: evaluable.length,
    excluded_no_ground_truth: excluded,
    baseline_definition: {
      traditional: `Rule-based, current state: flag if attendance < ${RULE_ATTENDANCE_THRESHOLD}%, OR most recent quiz < ${RULE_QUIZ_THRESHOLD}%, OR >= ${RULE_MISSED_ASSIGNMENTS_THRESHOLD} missed assignments.`,
      ai_twin: 'Flag if the most recent RiskAssessment.riskLevel is HIGH or CRITICAL.',
      ground_truth_proxy: `PROXY, not a real outcome label: average ConceptMastery.masteryScore < ${MASTERY_STRUGGLING_THRESHOLD}. The schema has no failed/withdrawn/struggling field. Students with no mastery records have no ground truth and are excluded.`,
    },
    metrics: {
      traditional,
      ai_twin: aiTwin,
      early_detection_days: avgEarlyDays !== null ? Number(avgEarlyDays.toFixed(2)) : null,
      early_detection_weeks: avgEarlyDays !== null ? Number((avgEarlyDays / 7).toFixed(2)) : null,
      early_detection_sample_size: both.length,
      early_detection_note:
        both.length === 0
          ? 'No evaluated student is currently flagged by both systems, so early detection cannot be computed yet.'
          : `Averaged over ${both.length} student(s) currently flagged by both systems. Positive = the AI flagged earlier.`,
    },
    unmeasured_metrics: {
      personalization_depth: {
        value: null,
        reason:
          'Not numerically measurable from the current schema. Counting distinct recommendations measures variety, not personalization quality. Planned as a qualitative assessment or Review-2 survey metric.',
      },
      intervention_usefulness_score: {
        value: null,
        reason:
          'Requires outcome feedback after an Intervention (did the student improve, did they find it useful). Intervention.outcome exists as free text but is not populated. Planned for a Review-2 survey or structured outcome field.',
      },
    },
    caveats: [
      'CIRCULARITY: the AI risk score includes a knowledge-gap component computed from the same ConceptMastery data used as the ground-truth proxy, so the AI is partly graded against its own input. This favours the AI twin; the rule baseline never uses mastery.',
      'The ground-truth proxy (average mastery < 70%) is a substitute for a real labelled outcome, not a verified measure of failure or success.',
      `${excluded} of ${evaluations.length} student(s) had no ConceptMastery records, so no ground truth, and were excluded from precision, recall and false-positive rate.`,
      'Early-detection dates are approximated from the earliest database record in each system\'s current flagged streak; the traditional system does not exist outside this script, so no "alert sent" timestamp exists for it.',
      'Assignment.dueDate defaults to the creation time when not set explicitly, so missed-assignment counts depend on real due dates having been entered.',
      'Sample size is small (seeded/test data). Treat these numbers as a methodology demonstration, not a statistically robust result. Re-run after real usage data accumulates.',
    ],
  };
}
