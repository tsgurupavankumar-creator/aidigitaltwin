import { prisma } from '@/lib/prisma';

export const getStudentDigitalTwin = (studentId: string) => prisma.digitalTwin.findUnique({ where: { studentId } });
export const getStudentKnowledgeGaps = (studentId: string) => prisma.conceptMastery.findMany({ where: { studentId, masteryScore: { lt: 70 } }, include: { concept: true }, orderBy: { masteryScore: 'asc' } });
export const getStudentRiskAssessment = (studentId: string) => prisma.riskAssessment.findFirst({ where: { studentId }, orderBy: { createdAt: 'desc' } });
export const getStudentAlerts = (studentId: string) => prisma.alert.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' } });
export const getStudentStudyPlan = (studentId: string) => prisma.studyPlan.findFirst({ where: { studentId }, include: { tasks: { include: { concept: true } } }, orderBy: { createdAt: 'desc' } });
export async function getStudentAttendanceSummary(studentId: string) {
  const [total, present] = await Promise.all([prisma.attendance.count({ where: { studentId } }), prisma.attendance.count({ where: { studentId, status: { in: ['PRESENT', 'LATE'] } } })]);
  return { total, present, percentage: total ? (present / total) * 100 : 0 };
}