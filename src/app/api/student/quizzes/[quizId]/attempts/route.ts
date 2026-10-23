import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { applyMastery, observedByConcept } from '@/lib/twin/mastery';
import { scheduleTwinSync } from '@/lib/twin/sync';

interface RouteContext {
  params: Promise<{ quizId: string }>;
}

const bodySchema = z.object({
  answers: z.record(z.string(), z.string().max(4000)),
}).strict();

function normalizeAnswer(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;
  const studentId = auth.user.student?.id;
  if (!studentId) return NextResponse.json({ error: 'Student profile not found.' }, { status: 403 });

  try {
    const input = bodySchema.parse(await req.json());
    const { quizId } = await context.params;
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { course: true, questions: true },
    });
    if (!quiz) return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });

    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId: quiz.courseId } },
      select: { id: true },
    });
    if (!enrollment) return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    if (!quiz.questions.length) return NextResponse.json({ error: 'This quiz has no questions.' }, { status: 400 });
    if (Object.keys(input.answers).some((questionId) => !quiz.questions.some((question) => question.id === questionId))) {
      return NextResponse.json({ error: 'Answers contain a question that is not part of this quiz.' }, { status: 400 });
    }

    const graded = quiz.questions.map((question) => ({
      questionId: question.id,
      conceptId: question.conceptId,
      studentAnswer: input.answers[question.id] ?? '',
      isCorrect: normalizeAnswer(input.answers[question.id] ?? '') === normalizeAnswer(question.correctAnswer),
    }));
    const score = graded.filter((answer) => answer.isCorrect).length;
    const total = quiz.questions.length;
    const percentage = (100 * score) / total;

    await prisma.$transaction(async (tx) => {
      const attempt = await tx.quizAttempt.create({
        data: { studentId, quizId, score, percentage },
        select: { id: true },
      });
      await tx.quizResponse.createMany({
        data: graded.map((answer) => ({
          attemptId: attempt.id,
          questionId: answer.questionId,
          studentAnswer: answer.studentAnswer,
          isCorrect: answer.isCorrect,
        })),
      });
      await applyMastery(tx, studentId, observedByConcept(graded));
    });

    const twinUpdatesQueued = scheduleTwinSync([{
      studentId,
      event: 'quiz_attempted',
      sourceKey: `quiz:${quizId}:${Date.now()}`,
    }]);
    return NextResponse.json({ score, total, percentage, twinUpdatesQueued }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid answers.' }, { status: 400 });
    }
    console.error('[STUDENT_QUIZ_ATTEMPT_ERROR]', error);
    return NextResponse.json({ error: 'Unable to submit quiz.' }, { status: 500 });
  }
}
