import { AgentType as PrismaAgentType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { predictAttendance } from '@/lib/ml/client';
import type { AgentResult, AttendancePrediction } from './types';

export async function runAttendanceRisk(studentId: string, triggeredBy = 'manual_trigger'): Promise<AgentResult> {
  const startedAt = Date.now();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const attendance = await prisma.attendance.findMany({
    where: { studentId, createdAt: { gte: since } },
    include: { lecture: true },
    orderBy: { createdAt: 'asc' },
  });
  const presentCount = attendance.filter((record) => record.status === 'PRESENT' || record.status === 'LATE').length;
  const currentAttendance = attendance.length ? (presentCount / attendance.length) * 100 : 100;
  const recentHalf = attendance.slice(Math.floor(attendance.length / 2));
  const recentPresent = recentHalf.filter((record) => record.status === 'PRESENT' || record.status === 'LATE').length;
  const recentRate = recentHalf.length ? recentPresent / recentHalf.length : currentAttendance / 100;
  const absenceRate = attendance.length ? 1 - currentAttendance / 100 : 0;
  const features = {
    currentAttendance,
    recentAttendance: recentRate * 100,
    attendanceCount: attendance.length,
    absenceRate,
  };

  try {
    const model = await predictAttendance(studentId, features);
    const riskScore = Math.max(0, Math.min(1, model.riskScore));
    const projectedAttendance = Math.max(0, Math.min(100, currentAttendance + (recentRate * 100 - currentAttendance) * 2));
    const daysUntilCritical = recentRate < 0.75 && attendance.length ? Math.max(0, Math.ceil((currentAttendance - 75) / Math.max(0.1, 1 - recentRate) * 2)) : 999;
    const prediction: AttendancePrediction = {
      atRisk: riskScore >= 0.5 || projectedAttendance < 75,
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
      reasoning: `Attendance was ${currentAttendance.toFixed(1)}% across ${attendance.length} recorded lectures in the last 30 days; the recent attendance trend is ${ (recentRate * 100).toFixed(1)}%.`,
      recommendedAction: prediction.atRisk ? 'Attend the next scheduled sessions and contact faculty if an absence is unavoidable.' : 'Maintain attendance and monitor the next two weeks of sessions.',
      confidence: prediction.confidence,
      executedAt: new Date(),
    };
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
