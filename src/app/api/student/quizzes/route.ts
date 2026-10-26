import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export async function GET() {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;

  try {
    const studentId = auth.user.student!.id;

    // Get courses the student is enrolled in
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId },
      select: { courseId: true },
    });

    const courseIds = enrollments.map((e) => e.courseId);

    const quizzes = await prisma.quiz.findMany({
      where: {
        courseId: { in: courseIds },
      },
      include: {
        course: {
          select: { id: true, code: true, name: true, department: true },
        },
        _count: {
          select: { questions: true },
        },
        attempts: {
          where: { studentId },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formattedQuizzes = quizzes.map((quiz) => {
      const lastAttempt = quiz.attempts[0];
      return {
        id: quiz.id,
        title: quiz.title,
        subject: quiz.course.name,
        courseCode: quiz.course.code,
        questions: quiz._count.questions || 5,
        duration: `${quiz.durationMins || 20} mins`,
        difficulty: quiz.isAIGenerated ? 'Adaptive' : 'Standard',
        score: lastAttempt ? `${Math.round(lastAttempt.percentage)}%` : 'Pending',
        isAIGenerated: quiz.isAIGenerated,
        recommendationReason: quiz.isAIGenerated
          ? 'Automated adaptive diagnostic quiz dispatched by AI Agent.'
          : `Curriculum assessment for ${quiz.course.code}.`,
      };
    });

    return NextResponse.json({ data: formattedQuizzes });
  } catch (error) {
    console.error('[STUDENT_QUIZZES_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch quizzes' }, { status: 500 });
  }
}
