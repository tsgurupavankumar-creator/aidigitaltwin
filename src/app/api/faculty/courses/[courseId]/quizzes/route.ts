import { prepareQuestions, question, quizSettings, settingsFrom } from '@/lib/twin/quiz-admin';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireOwnCourse } from '@/lib/twin/access';
import { handle } from '@/lib/twin/http';

type Ctx = { params: Promise<{ courseId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle('QUIZZES_GET', async () => {
    const { courseId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const quizzes = await prisma.quiz.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, durationMins: true, maxAttempts: true, opensAt: true, closesAt: true, isClosed: true, createdAt: true, _count: { select: { questions: true, attempts: true } } },
    });
    return NextResponse.json({
      quizzes: quizzes.map((q) => ({ id: q.id, title: q.title, durationMins: q.durationMins, maxAttempts: q.maxAttempts, opensAt: q.opensAt, closesAt: q.closesAt, isClosed: q.isClosed, createdAt: q.createdAt, questions: q._count.questions, attempts: q._count.attempts })),
    });
  });
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  durationMins: z.number().int().min(1).max(600),
  ...quizSettings,
  questions: z.array(question).min(1).max(100),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  return handle('QUIZZES_POST', async () => {
    const { courseId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const input = createSchema.parse(await req.json());
    const rows = await prepareQuestions(courseId, input.questions);
    const settings = settingsFrom(input);
    const quiz = await prisma.$transaction(async (tx) => {
      const created = await tx.quiz.create({ data: { courseId, title: input.title, description: input.description, durationMins: input.durationMins, ...settings }, select: { id: true, title: true } });
      await tx.question.createMany({ data: rows.map((r) => ({ ...r, quizId: created.id })) });
      return created;
    });
    return NextResponse.json({ quiz: { ...quiz, questions: input.questions.length } }, { status: 201 });
  });
}
