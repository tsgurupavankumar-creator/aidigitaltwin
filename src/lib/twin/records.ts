import type { AttendanceStatus, Prisma, PrismaClient } from '@prisma/client';
import { applyMastery, observedByConcept } from './mastery';
import type { SyncTask } from './sync';

type Db = PrismaClient | Prisma.TransactionClient;

/** A problem with the input. Routes turn it into HTTP 400 (or the given status) with the message. */
export class RecordError extends Error {
  constructor(message: string, public status = 400, public details?: unknown) { super(message); }
}

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

async function enrolledSet(db: Db, courseId: string, studentIds: string[]) {
  const rows = await db.enrollment.findMany({ where: { courseId, studentId: { in: studentIds } }, select: { studentId: true } });
  return new Set(rows.map((r) => r.studentId));
}

function assertEnrolled(enrolled: Set<string>, studentIds: string[]) {
  const outsiders = [...new Set(studentIds.filter((id) => !enrolled.has(id)))];
  if (outsiders.length) throw new RecordError('Some students are not enrolled in this course.', 400, { studentIds: outsiders });
}

function assertUnique(ids: string[], what: string) {
  if (new Set(ids).size !== ids.length) throw new RecordError(`Each student may appear only once per ${what}.`);
}

// ---------------------------------------------------------------- attendance

export interface AttendanceInput { studentId: string; status: AttendanceStatus }

export async function saveAttendance(db: Db, courseId: string, lectureId: string, records: AttendanceInput[]) {
  const lecture = await db.lecture.findFirst({ where: { id: lectureId, courseId }, select: { id: true } });
  if (!lecture) throw new RecordError('Lecture not found', 404);
  assertUnique(records.map((r) => r.studentId), 'lecture');
  for (const r of records) if (!ATTENDANCE_STATUSES.includes(r.status)) throw new RecordError(`Invalid status "${r.status}".`);
  const ids = records.map((r) => r.studentId);
  assertEnrolled(await enrolledSet(db, courseId, ids), ids);

  const existing = await db.attendance.findMany({ where: { lectureId, studentId: { in: ids } }, select: { studentId: true, status: true } });
  const before = new Map(existing.map((e) => [e.studentId, e.status]));
  const tasks: SyncTask[] = [];
  let unchanged = 0;
  for (const r of records) {
    if (before.get(r.studentId) === r.status) { unchanged += 1; continue; }
    const saved = await db.attendance.upsert({
      where: { studentId_lectureId: { studentId: r.studentId, lectureId } },
      create: { studentId: r.studentId, lectureId, status: r.status },
      update: { status: r.status },
      select: { id: true, updatedAt: true },
    });
    tasks.push({ studentId: r.studentId, event: 'attendance_marked', sourceKey: `attendance:${saved.id}:${saved.updatedAt.toISOString()}` });
  }
  return { saved: tasks.length, unchanged, tasks };
}

// ---------------------------------------------------------------- grades

export interface GradeInput { studentId: string; marksObtained: number }

export async function saveGrades(db: Db, courseId: string, assignmentId: string, grades: GradeInput[]) {
  const assignment = await db.assignment.findFirst({
    where: { id: assignmentId, courseId },
    select: { id: true, maxMarks: true, questions: { select: { conceptId: true } } },
  });
  if (!assignment) throw new RecordError('Assignment not found', 404);
  assertUnique(grades.map((g) => g.studentId), 'assignment');
  for (const g of grades) {
    if (!Number.isFinite(g.marksObtained) || g.marksObtained < 0 || g.marksObtained > assignment.maxMarks) {
      throw new RecordError(`Marks must be between 0 and ${assignment.maxMarks}.`, 400, { studentId: g.studentId, marksObtained: g.marksObtained });
    }
  }
  const ids = grades.map((g) => g.studentId);
  assertEnrolled(await enrolledSet(db, courseId, ids), ids);

  const existing = await db.submission.findMany({ where: { assignmentId, studentId: { in: ids } }, select: { studentId: true, marksObtained: true, status: true } });
  const before = new Map(existing.map((e) => [e.studentId, e]));
  const conceptIds = [...new Set(assignment.questions.map((q) => q.conceptId))];
  const tasks: SyncTask[] = [];
  let unchanged = 0;
  for (const g of grades) {
    const prev = before.get(g.studentId);
    if (prev && prev.status === 'GRADED' && prev.marksObtained === g.marksObtained) { unchanged += 1; continue; }
    const saved = await db.submission.upsert({
      where: { studentId_assignmentId: { studentId: g.studentId, assignmentId } },
      create: { studentId: g.studentId, assignmentId, status: 'GRADED', marksObtained: g.marksObtained },
      update: { status: 'GRADED', marksObtained: g.marksObtained },
      select: { id: true, updatedAt: true },
    });
    // The assignment's questions say which concepts it assesses; without
    // per-question marks, the overall percentage is the evidence for each.
    if (conceptIds.length) {
      const pct = (100 * g.marksObtained) / assignment.maxMarks;
      await applyMastery(db, g.studentId, Object.fromEntries(conceptIds.map((id) => [id, pct])));
    }
    tasks.push({ studentId: g.studentId, event: 'assignment_submitted', sourceKey: `grade:${saved.id}:${saved.updatedAt.toISOString()}` });
  }
  return { saved: tasks.length, unchanged, tasks };
}

// ---------------------------------------------------------------- quiz attempts

export function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface GradedQuestion { questionId: string; conceptId: string; studentAnswer: string; isCorrect: boolean; correctAnswer: string }

/** Pure grading. Unanswered questions count as wrong; unknown question ids are rejected. */
export function gradeQuiz(
  questions: Array<{ id: string; conceptId: string; correctAnswer: string }>,
  answers: Record<string, string>
): GradedQuestion[] {
  const known = new Set(questions.map((q) => q.id));
  const unknown = Object.keys(answers).filter((id) => !known.has(id));
  if (unknown.length) throw new RecordError('Answers include questions that are not in this quiz.', 400, { questionIds: unknown });
  return questions.map((q) => {
    const studentAnswer = typeof answers[q.id] === 'string' ? answers[q.id].slice(0, 2000) : '';
    return {
      questionId: q.id,
      conceptId: q.conceptId,
      studentAnswer,
      isCorrect: studentAnswer !== '' && normalizeAnswer(studentAnswer) === normalizeAnswer(q.correctAnswer),
      correctAnswer: q.correctAnswer,
    };
  });
}

export async function recordQuizAttempt(db: Db, studentId: string, quizId: string, answers: Record<string, string>) {
  const quiz = await db.quiz.findUnique({ where: { id: quizId }, select: { id: true, courseId: true, questions: { select: { id: true, conceptId: true, correctAnswer: true } } } });
  if (!quiz) throw new RecordError('Quiz not found', 404);
  if (!quiz.questions.length) throw new RecordError('This quiz has no questions yet.', 409);
  if (!(await enrolledSet(db, quiz.courseId, [studentId])).has(studentId)) throw new RecordError('Quiz not found', 404);

  const graded = gradeQuiz(quiz.questions, answers);
  const correct = graded.filter((g) => g.isCorrect).length;
  const percentage = Math.round((1000 * correct) / graded.length) / 10;
  const attempt = await db.quizAttempt.create({ data: { studentId, quizId, score: correct, percentage }, select: { id: true } });
  await db.quizResponse.createMany({
    data: graded.map((g) => ({ attemptId: attempt.id, questionId: g.questionId, studentAnswer: g.studentAnswer, isCorrect: g.isCorrect })),
  });
  const masteryUpdated = await applyMastery(db, studentId, observedByConcept(graded));
  const task: SyncTask = { studentId, event: 'quiz_attempted', sourceKey: `quiz-attempt:${attempt.id}` };
  return { attemptId: attempt.id, score: correct, total: graded.length, percentage, masteryUpdated, graded, tasks: [task] };
}

// ---------------------------------------------------------------- assignment submission

export async function submitAssignment(db: Db, studentId: string, assignmentId: string, now = new Date()) {
  const assignment = await db.assignment.findUnique({ where: { id: assignmentId }, select: { id: true, courseId: true, dueDate: true } });
  if (!assignment || !(await enrolledSet(db, assignment.courseId, [studentId])).has(studentId)) throw new RecordError('Assignment not found', 404);
  const existing = await db.submission.findUnique({ where: { studentId_assignmentId: { studentId, assignmentId } }, select: { status: true } });
  if (existing?.status === 'GRADED') throw new RecordError('This assignment has already been graded.', 409);
  const status = now > assignment.dueDate ? 'LATE' : 'SUBMITTED';
  const saved = await db.submission.upsert({
    where: { studentId_assignmentId: { studentId, assignmentId } },
    create: { studentId, assignmentId, status, submittedAt: now },
    update: { status, submittedAt: now },
    select: { id: true, status: true, submittedAt: true, updatedAt: true },
  });
  return {
    submission: { id: saved.id, status: saved.status, submittedAt: saved.submittedAt },
    tasks: [{ studentId, event: 'assignment_submitted', sourceKey: `submission:${saved.id}:${saved.updatedAt.toISOString()}` } as SyncTask],
  };
}
