import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ quizId: string }>;
}

export async function GET(_req: Request, context: RouteContext) {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;

  const studentId = auth.user.student?.id;
  if (!studentId) return NextResponse.json({ error: 'Student profile not found.' }, { status: 403 });
  const { quizId } = await context.params;

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      course: { select: { id: true, code: true, name: true } },
      questions: {
        select: { id: true, conceptId: true, type: true, difficulty: true, options: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!quiz) return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });

  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId: quiz.courseId } },
    select: { id: true },
  });
  if (!enrollment) return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });

  return NextResponse.json({
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      durationMins: quiz.durationMins,
      course: quiz.course,
      questions: quiz.questions.map((question) => ({
        id: question.id,
        conceptId: question.conceptId,
        type: question.type,
        difficulty: question.difficulty,
        options: question.options,
      })),
    },
  });
}
