import { prisma } from '@/lib/prisma';
import type { DimensionInputs } from './dimensions';

/** Loads what computeTwinDimensions needs for one student. */
export async function loadDimensionInputs(studentId: string, now = new Date()): Promise<DimensionInputs> {
  const inCourses = { course: { enrollments: { some: { studentId } } } };
  const [attendance, pastDue, submissions, quizzesAvailable, attempts, mastery, tasksDue] = await Promise.all([
    prisma.attendance.findMany({ where: { studentId }, select: { status: true } }),
    prisma.assignment.findMany({ where: { dueDate: { lt: now }, ...inCourses }, select: { id: true } }),
    prisma.submission.findMany({
      where: { studentId, status: { not: 'DRAFT' } },
      select: { assignmentId: true, submittedAt: true, assignment: { select: { dueDate: true } } },
    }),
    prisma.quiz.count({ where: inCourses }),
    prisma.quizAttempt.findMany({ where: { studentId }, select: { quizId: true } }),
    prisma.conceptMastery.findMany({ where: { studentId }, select: { masteryScore: true, previousScore: true, assessmentCount: true } }),
    prisma.studyTask.findMany({ where: { studyPlan: { studentId }, scheduledFor: { lt: now } }, select: { completed: true } }),
  ]);
  const handedInIds = new Set(submissions.map((s) => s.assignmentId));
  return {
    attendance: attendance.map((a) => a.status),
    pastDueAssignments: pastDue.length,
    handedInPastDue: pastDue.filter((a) => handedInIds.has(a.id)).length,
    handedIn: submissions.length,
    handedInLate: submissions.filter((s) => s.submittedAt && s.assignment && s.submittedAt > s.assignment.dueDate).length,
    quizzesAvailable,
    quizzesAttempted: new Set(attempts.map((a) => a.quizId)).size,
    mastery,
    studyTasksDue: tasksDue.length,
    studyTasksDone: tasksDue.filter((t) => t.completed).length,
  };
}
