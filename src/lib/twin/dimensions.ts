/**
 * The four twin dimensions that are not model predictions, computed from the student's own records.
 * Transparent, documented rules (not trained models; there is no labelled data to validate them yet).
 * A dimension with no data behind it returns null and the twin keeps its previous value: never invented.
 *
 *   engagement (0-100)  weighted share of: lectures attended (0.4), past-due assignments handed in (0.4),
 *                       available quizzes attempted (0.2); missing parts are left out and the rest re-weighted
 *   behaviour (0-100)   punctuality and reliability: 100 x (1 - 0.5 x late rate - 0.5 x missed rate)
 *   skills (0-100)      share of the student's assessed concepts at mastery >= 70%
 *   learningVelocity    mastery trend, 0..1 (0.5 = steady): 0.5 + mean change in mastery / 40, clamped;
 *                       a mean gain of +20 points reads 1.0, a mean loss of -20 reads 0.0
 */
export interface DimensionInputs {
  /** Attendance statuses (EXCUSED are left out). */
  attendance: string[];
  /** Assignments in the student's courses whose due date has passed. */
  pastDueAssignments: number;
  /** Of those, how many the student handed in. */
  handedInPastDue: number;
  /** Assignments handed in (any due date) and how many of those were late. */
  handedIn: number;
  handedInLate: number;
  /** Quizzes in the student's courses, and how many distinct ones they attempted. */
  quizzesAvailable: number;
  quizzesAttempted: number;
  /** Concept mastery records (only assessed concepts count). */
  mastery: Array<{ masteryScore: number; previousScore: number | null; assessmentCount: number }>;
}

export interface TwinDimensions {
  engagementScore: number | null;
  behaviorScore: number | null;
  skillsScore: number | null;
  learningVelocity: number | null;
}

export const MASTERY_SKILL_THRESHOLD = 70;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

export function computeTwinDimensions(d: DimensionInputs): TwinDimensions {
  const counted = d.attendance.filter((s) => s !== 'EXCUSED');
  const parts: Array<[number, number]> = [];
  if (counted.length) parts.push([0.4, counted.filter((s) => s === 'PRESENT' || s === 'LATE').length / counted.length]);
  if (d.pastDueAssignments > 0) parts.push([0.4, Math.min(1, d.handedInPastDue / d.pastDueAssignments)]);
  if (d.quizzesAvailable > 0) parts.push([0.2, Math.min(1, d.quizzesAttempted / d.quizzesAvailable)]);
  const weight = parts.reduce((a, [w]) => a + w, 0);
  const engagementScore = weight ? round1((100 * parts.reduce((a, [w, v]) => a + w * v, 0)) / weight) : null;

  const lateRate = d.handedIn > 0 ? d.handedInLate / d.handedIn : null;
  const missedRate = d.pastDueAssignments > 0 ? 1 - Math.min(1, d.handedInPastDue / d.pastDueAssignments) : null;
  let behaviorScore: number | null = null;
  if (lateRate !== null || missedRate !== null) {
    const penalty = lateRate !== null && missedRate !== null ? 0.5 * lateRate + 0.5 * missedRate : (lateRate ?? missedRate)!;
    behaviorScore = round1(100 * (1 - penalty));
  }

  const assessed = d.mastery.filter((m) => m.assessmentCount > 0);
  const skillsScore = assessed.length
    ? round1((100 * assessed.filter((m) => m.masteryScore >= MASTERY_SKILL_THRESHOLD).length) / assessed.length)
    : null;

  const changes = assessed.filter((m) => m.previousScore !== null).map((m) => m.masteryScore - (m.previousScore as number));
  const learningVelocity = changes.length
    ? Math.round(clamp(0.5 + changes.reduce((a, b) => a + b, 0) / changes.length / 40, 0, 1) * 1000) / 1000
    : null;

  return { engagementScore, behaviorScore, skillsScore, learningVelocity };
}
