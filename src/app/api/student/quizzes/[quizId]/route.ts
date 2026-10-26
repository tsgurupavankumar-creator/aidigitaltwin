import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/twin/access';
import { handle } from '@/lib/twin/http';
import { displayQuestion } from '@/lib/twin/quiz';
import { RecordError } from '@/lib/twin/records';

type Ctx = { params: Promise<{ quizId: string }> };

/** The quiz to take. Correct answers are never sent. Auth is checked before any quiz lookup. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle('STUDENT_QUIZ_GET', async () => {
    const auth = await requireUser('student');
    if (!auth.ok) return auth.error;
    const studentId = auth.user.student?.id;
    if (!studentId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { quizId } = await ctx.params;
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: {
        id: true, title: true, description: true, durationMins: true, courseId: true,
        course: { select: { code: true, name: true } },
        questions: { orderBy: { createdAt: 'asc' }, select: { id: true, type: true, difficulty: true, options: true, concept: { select: { name: true } } } },
      },
    });
    const enrolled = quiz && (await prisma.enrollment.findUnique({ where: { studentId_courseId: { studentId, courseId: quiz.courseId } }, select: { id: true } }));
    if (!quiz || !enrolled) throw new RecordError('Quiz not found', 404);
    const attempts = await prisma.quizAttempt.count({ where: { quizId, studentId } });
    return NextResponse.json({
      quiz: {
        id: quiz.id, title: quiz.title, description: quiz.description, durationMins: quiz.durationMins, course: quiz.course, attempts,
        questions: quiz.questions.map((q, i) => ({ id: q.id, type: q.type, difficulty: q.difficulty, concept: q.concept.name, ...displayQuestion(q.options, q.type, q.concept.name, i) })),
      },
    });
  });
}
