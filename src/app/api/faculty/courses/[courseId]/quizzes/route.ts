import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireOwnCourse } from '@/lib/twin/access';
import { handle, cuid } from '@/lib/twin/http';
import { RecordError } from '@/lib/twin/records';
import { questionOptions } from '@/lib/twin/quiz';

type Ctx = { params: Promise<{ courseId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle('QUIZZES_GET', async () => {
    const { courseId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const quizzes = await prisma.quiz.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, durationMins: true, createdAt: true, _count: { select: { questions: true, attempts: true } } },
    });
    return NextResponse.json({
      quizzes: quizzes.map((q) => ({ id: q.id, title: q.title, durationMins: q.durationMins, createdAt: q.createdAt, questions: q._count.questions, attempts: q._count.attempts })),
    });
  });
}

const question = z.object({
  prompt: z.string().trim().min(1).max(2000),
  type: z.enum(['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER']),
  choices: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
  correctAnswer: z.string().trim().min(1).max(500),
  conceptId: cuid,
  difficulty: z.number().int().min(1).max(5).default(3),
});

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  durationMins: z.number().int().min(1).max(600),
  questions: z.array(question).min(1).max(100),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  return handle('QUIZZES_POST', async () => {
    const { courseId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const input = createSchema.parse(await req.json());
    input.questions.forEach((q, i) => {
      if (q.type === 'MCQ' && q.choices.length < 2) throw new RecordError(`Question ${i + 1}: a multiple-choice question needs at least 2 choices.`);
      const choices = questionOptions(q).choices;
      if (choices.length && !choices.some((c) => c.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase())) {
        throw new RecordError(`Question ${i + 1}: the correct answer must be one of the choices.`);
      }
    });
    const conceptIds = [...new Set(input.questions.map((q) => q.conceptId))];
    const found = await prisma.concept.count({ where: { courseId, id: { in: conceptIds } } });
    if (found !== conceptIds.length) throw new RecordError('Some concepts do not belong to this course.');
    const quiz = await prisma.$transaction(async (tx) => {
      const created = await tx.quiz.create({ data: { courseId, title: input.title, description: input.description, durationMins: input.durationMins }, select: { id: true, title: true } });
      await tx.question.createMany({
        data: input.questions.map((q) => ({
          quizId: created.id, conceptId: q.conceptId, type: q.type, difficulty: q.difficulty,
          options: questionOptions(q), correctAnswer: q.type === 'TRUE_FALSE' ? (q.correctAnswer.toLowerCase().startsWith('t') ? 'True' : 'False') : q.correctAnswer,
        })),
      });
      return created;
    });
    return NextResponse.json({ quiz: { ...quiz, questions: input.questions.length } }, { status: 201 });
  });
}
