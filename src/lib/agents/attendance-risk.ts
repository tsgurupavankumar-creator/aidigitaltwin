import { AgentType as PrismaAgentType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { predictAttendance } from '@/lib/ml/client';
import type { AgentResult, AttendancePrediction } from './types';
import { loadAssessedWork } from './assessed-work';
import { buildEarlyWarningFeatures } from './early-warning-features';

/** Class attendance % (PRESENT or LATE, EXCUSED left out) on the given lectures; null when none recorded. */
export async function classAttendanceRate(lectureIds: string[]): Promise<number | null> {
  if (!lectureIds.length) return null;
  const rows = await prisma.attendance.findMany({ where: { lectureId: { in: [...new Set(lectureIds)] } }, select: { status: true } });
  const counted = rows.filter((r) => r.status !== 'EXCUSED');
  if (!counted.length) return null;
  return (100 * counted.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length) / counted.length;
}

export async function runAttendanceRisk(studentId: string, triggeredBy = 'manual_trigger'): Promise<AgentResult> {
  const startedAt = Date.now();
  const [attendance, work] = await Promise.all([
    prisma.attendance.findMany({ where: { studentId }, orderBy: { createdAt: 'asc' } }),
    loadAssessedWork(studentId),
  ]);
  // Reasoning: online-presence stand-in (lecture attendance here) plus what is
  // known about assessed work so far, exactly as in training
  // (early-warning-features.ts). EXCUSED lectures are left out.
  const features: Record<string, number | null> = {
    ...buildEarlyWarningFeatures(attendance.map((a) => a.status), work, await classAttendanceRate(attendance.map((a) => a.lectureId))),
  };
  const currentAttendance = features.currentAttendance as number;
  const recentRate = (features.recentAttendance as number) / 100;

  try {
    const model = await predictAttendance(studentId, features);
    if (model.modelUsed !== 'trained') {
      // See the matching comment in learning-analysis.ts — a fallback
      // prediction here is an untrained heuristic, never a real risk
      // assessment, and must not be persisted as though it were one.
      throw new Error(
        `Attendance risk ML service returned a fallback prediction (no trained model loaded) for studentId=${studentId}. Refusing to use an untrained prediction.`
      );
    }
    const riskScore = Math.max(0, Math.min(1, model.riskScore));
    const projectedAttendance = Math.max(0, Math.min(100, currentAttendance + (recentRate * 100 - currentAttendance) * 2));
    const daysUntilCritical = recentRate < 0.75 && attendance.length ? Math.max(0, Math.ceil((currentAttendance - 75) / Math.max(0.1, 1 - recentRate) * 2)) : 999;
    const prediction: AttendancePrediction = {
      modelUsed: model.modelUsed,
      reasons: model.reasons ?? [],
      modelVersion: model.modelVersion ?? null,
      // The alert threshold comes from training (chosen on validation data); 0.5 only for older models.
      atRisk: riskScore >= (model.threshold ?? 0.5) || projectedAttendance < 75,
      riskScore,
      currentAttendance,
      projectedAttendance,
      daysUntilCritical,
      confidence: Math.max(0, Math.min(1, model.confidence)),
    };
    const result: AgentResult = {
      agentType: 'ATTENDANCE_RISK',
      studentId,
      prediction,
      reasoning: `${model.modelUsed === 'trained' ? 'The trained model found' : 'An untrained fallback heuristic (no trained model available yet) estimated'} attendance was ${currentAttendance.toFixed(1)}% across ${attendance.length} recorded lectures; the recent attendance trend is ${(recentRate * 100).toFixed(1)}%.`,
      recommendedAction: prediction.atRisk ? 'Attend the next scheduled sessions and contact faculty if an absence is unavoidable.' : 'Maintain attendance and monitor the next two weeks of sessions.',
      confidence: prediction.confidence,
      executedAt: new Date(),
    };
    // Persistence: store the prediction and its feature snapshot in AgentLog;
    // failures are logged separately below instead of being treated as results.
    await prisma.agentLog.create({
      data: {
        studentId,
        agentType: PrismaAgentType.ATTENDANCE,
        status: 'COMPLETED',
        input: { studentId, features, triggeredBy },
        output: result as unknown as object,
        confidence: result.confidence,
        triggeredBy,
        executionTimeMs: Date.now() - startedAt,
      },
    });
    return result;
  } catch (error) {
    await prisma.agentLog.create({
      data: {
        studentId,
        agentType: PrismaAgentType.ATTENDANCE,
        status: 'FAILED',
        input: { studentId, features, triggeredBy },
        output: { error: error instanceof Error ? error.message : 'Attendance model failed' },
        triggeredBy,
        executionTimeMs: Date.now() - startedAt,
      },
    });
    throw error;
  }
}
