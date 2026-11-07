import { prisma } from '@/lib/prisma';

/**
 * A student's assessed work, in the shape both ML models were trained on
 * (ml/oulad_features.py). Quizzes have no due date in this schema, so, as in
 * training (computer-marked assessments), they never count as late or missed;
 * lateness and missed work come from assignments (tutor-marked in OULAD).
 */
export interface AssessedWork {
  /** Quiz percentages, newest first (latest 10). */
  quizScoresNewestFirst: number[];
  /** Graded assignment percentages, newest first (latest 20). */
  gradedScoresNewestFirst: number[];
  /** All scored work (quizzes + graded assignments), oldest first. */
  scoresChronological: number[];
  /** Graded assignments that were handed in after their due date (learning model). */
  lateCount: number;
  /** Any assignment handed in after its due date, graded or not (early-warning model). */
  lateHandedInCount: number;
  /** Assignments in the student's courses already past due with nothing handed in. */
  missedCount: number;
  /** Mean of (student % - class mean %) over the scored items; null when no class data. */
  relativeToClass: number | null;
  /** Mean class % on those same items (how hard they were); null when no class data. */
  classAvgPrior: number | null;
  /** 1 when the next item is an assignment (one is due), else 0 (a quiz). The app has no exams. */
  nextIsAssignment: 0 | 1;
  /** When the most recent scored work happened; null when none. */
  lastScoredAt: Date | null;
}

export interface WorkInputs {
  quizzes: Array<{ percentage: number; createdAt: Date; quizId?: string }>;
  submissions: Array<{ marksObtained: number | null; submittedAt: Date | null; updatedAt: Date; status: string; assignmentId?: string; assignment: { maxMarks: number; dueDate: Date } }>;
  pastDueAssignmentIds: string[];
  submittedAssignmentIds: string[];
  /** Class mean % per quiz / per assignment (all students who did it). */
  classMeanByQuiz?: Record<string, number>;
  classMeanByAssignment?: Record<string, number>;
  hasUpcomingAssignment?: boolean;
}

/** Pure: turns raw rows into AssessedWork (tested without a database). */
export function summarizeWork(input: WorkInputs): AssessedWork {
  const quizzes = [...input.quizzes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10);
  const graded = input.submissions
    .filter((s) => s.marksObtained !== null && s.assignment.maxMarks > 0)
    .map((s) => ({ pct: (s.marksObtained! / s.assignment.maxMarks) * 100, at: s.submittedAt ?? s.updatedAt, late: !!s.submittedAt && s.submittedAt > s.assignment.dueDate }))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 20);
  const chronological = [
    ...quizzes.map((q) => ({ pct: q.percentage, at: q.createdAt })),
    ...graded.map((g) => ({ pct: g.pct, at: g.at })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const handedIn = new Set(input.submittedAssignmentIds);
  const pairs: Array<[number, number]> = [];
  for (const q of quizzes) { const m = q.quizId ? input.classMeanByQuiz?.[q.quizId] : undefined; if (m !== undefined) pairs.push([q.percentage, m]); }
  for (const s of input.submissions) {
    if (s.marksObtained === null || !(s.assignment.maxMarks > 0) || !s.assignmentId) continue;
    const m = input.classMeanByAssignment?.[s.assignmentId];
    if (m !== undefined) pairs.push([(s.marksObtained / s.assignment.maxMarks) * 100, m]);
  }
  const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  return {
    quizScoresNewestFirst: quizzes.map((q) => q.percentage),
    gradedScoresNewestFirst: graded.map((g) => g.pct),
    scoresChronological: chronological.map((c) => c.pct),
    lateCount: graded.filter((g) => g.late).length,
    lateHandedInCount: input.submissions.filter((s) => !!s.submittedAt && s.submittedAt > s.assignment.dueDate).length,
    missedCount: input.pastDueAssignmentIds.filter((id) => !handedIn.has(id)).length,
    relativeToClass: pairs.length ? avg(pairs.map(([s, m]) => s - m)) : null,
    classAvgPrior: pairs.length ? avg(pairs.map(([, m]) => m)) : null,
    nextIsAssignment: input.hasUpcomingAssignment ? 1 : 0,
    lastScoredAt: chronological.length ? chronological[chronological.length - 1].at : null,
  };
}

export async function loadAssessedWork(studentId: string, now = new Date()): Promise<AssessedWork> {
  const [quizzes, submissions, pastDue] = await Promise.all([
    prisma.quizAttempt.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, take: 10, select: { percentage: true, createdAt: true, quizId: true } }),
    prisma.submission.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      select: { assignmentId: true, marksObtained: true, submittedAt: true, updatedAt: true, status: true, assignment: { select: { maxMarks: true, dueDate: true } } },
    }),
    prisma.assignment.findMany({ where: { dueDate: { lt: now }, course: { enrollments: { some: { studentId } } } }, select: { id: true } }),
  ]);
  // Class means for the same items (every student who did them), and whether an assignment is coming up.
  const quizIds = [...new Set(quizzes.map((q) => q.quizId))];
  const assignmentIds = [...new Set(submissions.filter((s) => s.marksObtained !== null).map((s) => s.assignmentId))];
  const [classQuiz, classSubs, upcoming] = await Promise.all([
    quizIds.length ? prisma.quizAttempt.findMany({ where: { quizId: { in: quizIds } }, select: { quizId: true, percentage: true } }) : Promise.resolve([]),
    assignmentIds.length
      ? prisma.submission.findMany({ where: { assignmentId: { in: assignmentIds }, marksObtained: { not: null } }, select: { assignmentId: true, marksObtained: true, assignment: { select: { maxMarks: true } } } })
      : Promise.resolve([]),
    prisma.assignment.count({ where: { dueDate: { gte: now }, course: { enrollments: { some: { studentId } } } } }),
  ]);
  const meanBy = (rows: Array<[string, number]>) => {
    const acc = new Map<string, number[]>();
    for (const [k, v] of rows) acc.set(k, [...(acc.get(k) ?? []), v]);
    return Object.fromEntries([...acc].map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]));
  };
  return summarizeWork({
    classMeanByQuiz: meanBy(classQuiz.map((r) => [r.quizId, r.percentage])),
    classMeanByAssignment: meanBy(classSubs.filter((r) => r.marksObtained !== null && r.assignment.maxMarks > 0).map((r) => [r.assignmentId, (r.marksObtained! / r.assignment.maxMarks) * 100])),
    hasUpcomingAssignment: upcoming > 0,
    quizzes,
    submissions,
    pastDueAssignmentIds: pastDue.map((a) => a.id),
    submittedAssignmentIds: submissions.filter((s) => s.status !== 'DRAFT').map((s) => s.assignmentId),
  });
}
