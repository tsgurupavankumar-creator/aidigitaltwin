import { prisma } from '@/lib/prisma';
import { ActionType, AlertSeverity, AlertType, AgentType as PrismaAgentType, InterventionType } from '@prisma/client';
import { runAttendanceRisk } from './attendance-risk';
import { runKnowledgeGap } from './knowledge-gap';
import { runLearningAnalysis } from './learning-analysis';
import type { AgentResult, Intervention, StudentEvent } from './types';

const actionForFlag: Record<string, string> = {
  ATTENDANCE: 'Attend the next three scheduled sessions and contact faculty if support is needed.',
  PERFORMANCE: 'Schedule a focused revision block for the weakest recent concepts.',
  KNOWLEDGE: 'Complete a targeted practice set for the identified prerequisite gaps.',
};

function selectAgents(event: StudentEvent, attendanceScore: number) {
  const selected = new Set<string>();
  if (event === 'quiz_attempted' || event === 'assignment_submitted') {
    selected.add('learning');
    selected.add('knowledge');
  }
  if (event === 'attendance_marked') selected.add('attendance');
  if (event === 'weekly_review' || event === 'manual_trigger') {
    selected.add('learning');
    selected.add('attendance');
    selected.add('knowledge');
  }
  if (attendanceScore < 75) selected.add('attendance');
  return [...selected];
}

function decideIntervention(results: AgentResult[], studentId: string): Intervention {
  const flags = new Set<string>();
  for (const result of results) {
    if (result.agentType === 'ATTENDANCE_RISK' && 'atRisk' in result.prediction && result.prediction.atRisk) flags.add('ATTENDANCE');
    if (result.agentType === 'LEARNING_ANALYSIS' && 'trend' in result.prediction && result.prediction.trend === 'DOWN' && result.confidence >= 0.7) flags.add('PERFORMANCE');
    if (result.agentType === 'KNOWLEDGE_GAP' && 'overallGapScore' in result.prediction && result.prediction.overallGapScore > 60) flags.add('KNOWLEDGE');
  }
  const flagList = [...flags];
  const severity = flagList.length >= 2 ? 'HIGH' : flagList.length === 1 ? 'MEDIUM' : 'LOW';
  return {
    flags: flagList,
    severity,
    studentId,
    recommendedActions: flagList.length ? flagList.map((flag) => actionForFlag[flag]) : ['Continue the current learning routine and complete the next scheduled assessment.'],
    shouldEscalateToFaculty: severity === 'HIGH',
    triggeredAt: new Date(),
  };
}

async function persistIntervention(studentId: string, intervention: Intervention, results: AgentResult[]) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { department: true } });
  if (!student) throw new Error('Student not found while persisting intervention');

  const alertMessages: Array<{ type: AlertType; message: string }> = [];
  if (intervention.flags.includes('ATTENDANCE')) {
    alertMessages.push({ type: AlertType.ATTENDANCE, message: results.find((result) => result.agentType === 'ATTENDANCE_RISK')?.reasoning || 'Attendance risk detected.' });
  }
  if (intervention.flags.includes('PERFORMANCE')) {
    alertMessages.push({ type: AlertType.QUIZ, message: results.find((result) => result.agentType === 'LEARNING_ANALYSIS')?.reasoning || 'Learning performance trend requires attention.' });
  }
  if (intervention.flags.includes('KNOWLEDGE')) {
    alertMessages.push({ type: AlertType.RECOMMENDATION, message: results.find((result) => result.agentType === 'KNOWLEDGE_GAP')?.recommendedAction || 'Knowledge gaps require targeted practice.' });
  }
  for (const alert of alertMessages) {
    await prisma.alert.create({
      data: {
        studentId,
        type: alert.type,
        severity: intervention.severity === 'HIGH' ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
        message: alert.message,
      },
    });
  }

  for (const action of intervention.recommendedActions) {
    await prisma.recommendation.create({
      data: {
        studentId,
        agentType: PrismaAgentType.RECOMMENDATION,
        title: action,
        actionType: intervention.flags.includes('ATTENDANCE') ? ActionType.REVIEW : ActionType.PRACTICE,
        confidence: Math.max(...results.map((result) => result.confidence), 0),
      },
    });
  }

  if (!intervention.shouldEscalateToFaculty) return undefined;
  const faculty = await prisma.faculty.findFirst({
    where: { department: student.department, user: { status: 'ACTIVE' } },
    select: { id: true },
  });
  if (!faculty) return undefined;

  const type = intervention.flags.includes('ATTENDANCE') ? InterventionType.COUNSELING : intervention.flags.includes('PERFORMANCE') ? InterventionType.TUTORING : InterventionType.QUIZ;
  const persisted = await prisma.intervention.create({
    data: { facultyId: faculty.id, studentId, type, notes: intervention.recommendedActions.join(' ') },
    select: { id: true },
  });
  return persisted.id;
}

export async function orchestrate(studentId: string, event: StudentEvent) {
  const twin = await prisma.digitalTwin.findUnique({ where: { studentId } });
  if (!twin) throw new Error('Digital twin not found for student');

  const selected = selectAgents(event, twin.attendanceScore);
  const results = await Promise.all(selected.map((agent) => {
    if (agent === 'learning') return runLearningAnalysis(studentId, event);
    if (agent === 'attendance') return runAttendanceRisk(studentId, event);
    return runKnowledgeGap(studentId, event);
  }));
  const intervention = decideIntervention(results, studentId);
  const persistedInterventionId = await persistIntervention(studentId, intervention, results);
  return { results, intervention, persistedInterventionId, executedAt: new Date() };
}
