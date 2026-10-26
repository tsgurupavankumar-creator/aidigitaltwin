import { prisma } from '@/lib/prisma';
import { loadAssessedWork } from '@/lib/agents/assessed-work';
import { classAttendanceRate } from '@/lib/agents/attendance-risk';
import { buildEarlyWarningFeatures, type EarlyWarningFeatures } from '@/lib/agents/early-warning-features';
import { buildLearningFeatures, type LearningFeatures } from '@/lib/agents/learning-features';
import { computeRiskAssessment } from '@/lib/agents/risk-scoring';
import { loadRiskConfig } from '@/lib/agents/risk-config';
import { predictAttendance, predictLearning } from '@/lib/ml/client';

/**
 * What-if simulation on the digital twin: change a few of the student's inputs and see what the
 * SAME trained models and calibrated risk settings predict. Nothing is saved.
 *
 * Assumptions (shown to the user with every result):
 *  - attendance %: applies to all recorded lectures; the class average stays the same.
 *  - quiz average %: changes the quiz average; the overall average of scored work moves by the same
 *    amount times the share of quizzes in the student's scored work.
 *  - missed / late assignments: replace the current counts.
 */
export interface Scenario {
  attendancePct?: number;
  quizAveragePct?: number;
  missedAssignments?: number;
  lateAssignments?: number;
}

export const SCENARIO_ASSUMPTIONS = [
  'Attendance applies to all recorded lectures; the class average stays the same.',
  'A new quiz average shifts the overall average of scored work in proportion to the share of quizzes in it.',
  'Missed and late assignment counts replace the current counts.',
  'Concept mastery and knowledge gaps are unchanged.',
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function applyScenario(early: EarlyWarningFeatures, learning: LearningFeatures | null, s: Scenario) {
  const e = { ...early };
  const l = learning ? { ...learning } : null;
  if (s.attendancePct !== undefined) {
    const pct = clamp(s.attendancePct, 0, 100);
    if (e.presenceVsClass !== null) e.presenceVsClass = e.presenceVsClass + (pct - e.currentAttendance);
    e.currentAttendance = pct;
    e.recentAttendance = pct;
    e.absenceRate = 1 - pct / 100;
    if (l) { l.presenceRate = pct / 100; l.recentPresenceRate = pct / 100; }
  }
  if (s.quizAveragePct !== undefined) {
    const quiz = clamp(s.quizAveragePct, 0, 100);
    const current = l ? l.avgQuizScore : e.earlyAvgScore ?? quiz;
    const share = l && l.quizCount + l.submissionCount > 0 ? l.quizCount / (l.quizCount + l.submissionCount) : 1;
    const delta = (quiz - current) * share;
    e.earlyAvgScore = e.earlyAvgScore === null ? quiz : clamp(e.earlyAvgScore + delta, 0, 100);
    if (e.scoreVsClass !== null) e.scoreVsClass += delta;
    if (l) {
      l.avgQuizScore = quiz;
      l.avgMastery = clamp(l.avgMastery + delta, 0, 100);
      if (l.relativeToClass !== null) l.relativeToClass += delta;
    }
  }
  if (s.missedAssignments !== undefined) {
    e.earlyMissedCount = Math.max(0, Math.round(s.missedAssignments));
    if (l) l.missedCount = e.earlyMissedCount;
  }
  if (s.lateAssignments !== undefined) {
    e.earlyLateCount = Math.max(0, Math.round(s.lateAssignments));
    if (l) l.lateCount = e.earlyLateCount;
  }
  return { early: e, learning: l };
}

export class WhatIfUnavailable extends Error {}

export interface Outcome {
  riskProbability: number;
  riskLevel: string;
  riskScore: number;
  predictedMark: number | null;
  markRange: { low: number; high: number } | null;
}

async function predict(studentId: string, early: EarlyWarningFeatures, learning: LearningFeatures | null,
                       twin: { attendanceScore: number; knowledgeScore: number }): Promise<Outcome> {
  const att = await predictAttendance(studentId, { ...early });
  if (att.modelUsed !== 'trained') throw new WhatIfUnavailable('The ML service has no trained model loaded.');
  const learn = learning ? await predictLearning(studentId, { ...learning }) : null;
  if (learn && learn.modelUsed !== 'trained') throw new WhatIfUnavailable('The ML service has no trained model loaded.');
  const atRisk = att.riskScore >= (att.threshold ?? 0.5) || early.currentAttendance < 75;
  const assessment = computeRiskAssessment({
    twin,
    attendance: { modelUsed: 'trained', atRisk, riskScore: att.riskScore, currentAttendance: early.currentAttendance,
      projectedAttendance: early.currentAttendance, daysUntilCritical: 0, confidence: att.confidence } as never,
    learning: learn ? ({ modelUsed: 'trained', nextExamScore: learn.nextExamScore, confidence: learn.confidence,
      trend: learning && learn.nextExamScore > learning.avgQuizScore + 3 ? 'UP' : learning && learn.nextExamScore < learning.avgQuizScore - 3 ? 'DOWN' : 'STABLE',
      topWeakConcepts: [], topStrongConcepts: [] } as never) : undefined,
    confidences: [att.confidence, ...(learn ? [learn.confidence] : [])],
    config: loadRiskConfig(),
  });
  return {
    riskProbability: att.riskScore,
    riskLevel: assessment.riskLevel,
    riskScore: assessment.riskScore,
    predictedMark: learn ? learn.nextExamScore : null,
    markRange: learn && learn.low != null && learn.high != null ? { low: learn.low, high: learn.high } : null,
  };
}

export async function simulateWhatIf(studentId: string, scenario: Scenario) {
  const twin = await prisma.digitalTwin.findUnique({ where: { studentId }, select: { attendanceScore: true, knowledgeScore: true } });
  if (!twin) throw new WhatIfUnavailable('This student has no digital twin yet.');
  const [work, attendance] = await Promise.all([
    loadAssessedWork(studentId),
    prisma.attendance.findMany({ where: { studentId }, orderBy: { createdAt: 'asc' }, select: { status: true, lectureId: true } }),
  ]);
  const statuses = attendance.map((a) => a.status);
  const early = buildEarlyWarningFeatures(statuses, work, await classAttendanceRate(attendance.map((a) => a.lectureId)));
  const learning = buildLearningFeatures(work, statuses);
  const changed = applyScenario(early, learning, scenario);
  const [baseline, simulated] = await Promise.all([
    predict(studentId, early, learning, twin),
    predict(studentId, changed.early, changed.learning, twin),
  ]);
  return {
    current: { attendancePct: early.currentAttendance, quizAveragePct: learning?.avgQuizScore ?? null, missedAssignments: early.earlyMissedCount, lateAssignments: early.earlyLateCount },
    scenario,
    baseline,
    simulated,
    assumptions: SCENARIO_ASSUMPTIONS,
  };
}
