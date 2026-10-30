import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireOwnCourse } from '@/lib/twin/access';
import { handle } from '@/lib/twin/http';
import { RecordError } from '@/lib/twin/records';
import { toLocalInput } from '@/lib/twin/deadline';
import { prepareQuestions, question, quizSettings, settingsFrom } from '@/lib/twin/quiz-admin';

type Ctx = { params: Promise<{ courseId: string; quizId: string }> };

async function ownQuiz(courseId: string, quizId: string) {
  const quiz = await prisma.quiz.findFirst({ where: { id: quizId, courseId }, select: { id: true, _count: { select: { attempts: true } } } });
  if (!quiz) throw new RecordError('Quiz not found in this course', 404);
  return quiz;
}

/** The quiz with its questions (including answers), for editing. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle('QUIZ_GET', async () => {
    const { courseId, quizId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, courseId },
      select: {
        id: true, title: true, description: true, durationMins: true, maxAttempts: true, opensAt: true, closesAt: true, isClosed: true,
        _count: { select: { attempts: true } },
        questions: { orderBy: { createdAt: 'asc' }, select: { id: true, type: true, difficulty: true, options: true, correctAnswer: true, conceptId: true } },
      },
    });
    if (!quiz) throw new RecordError('Quiz not found in this course', 404);
    return NextResponse.json({
      quiz: {
        ...quiz, opensAt: toLocalInput(quiz.opensAt), closesAt: toLocalInput(quiz.closesAt), attempts: quiz._count.attempts,
        questionsLocked: quiz._count.attempts > 0,
        questions: quiz.questions.map((q) => {
          const o = (q.options ?? {}) as { prompt?: string; choices?: string[] };
          return { id: q.id, type: q.type, difficulty: q.difficulty, conceptId: q.conceptId, correctAnswer: q.correctAnswer, prompt: o.prompt ?? '', choices: o.choices ?? [] };
        }),
      },
    });
  });
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  durationMins: z.number().int().min(1).max(600).optional(),
  ...quizSettings,
  isClosed: z.boolean().optional(),
  questions: z.array(question).min(1).max(100).optional(),
});

/** Edit settings, close/reopen, or replace questions (only before anyone has attempted it). */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle('QUIZ_PATCH', async () => {
    const { courseId, quizId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const quiz = await ownQuiz(courseId, quizId);
    const input = patchSchema.parse(await req.json());
    if (input.questions && quiz._count.attempts > 0) {
      throw new RecordError('Questions cannot be changed after students have attempted the quiz (their results depend on them). Create a new quiz instead.', 409);
    }
    const rows = input.questions ? await prepareQuestions(courseId, input.questions) : null;
    const hasTimes = 'opensAt' in input || 'closesAt' in input || 'maxAttempts' in input;
    const settings = hasTimes ? settingsFrom(input) : {};
    await prisma.$transaction(async (tx) => {
      await tx.quiz.update({
        where: { id: quizId },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.durationMins !== undefined && { durationMins: input.durationMins }),
          ...(input.isClosed !== undefined && { isClosed: input.isClosed }),
          ...settings,
        },
      });
      if (rows) {
        await tx.question.deleteMany({ where: { quizId } });
        await tx.question.createMany({ data: rows.map((r) => ({ ...r, quizId })) });
      }
    });
    return NextResponse.json({ ok: true });
  });
}

/** Delete a quiz nobody has attempted. With attempts, close it instead (results and mastery stay). */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle('QUIZ_DELETE', async () => {
    const { courseId, quizId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const quiz = await ownQuiz(courseId, quizId);
    if (quiz._count.attempts > 0) {
      throw new RecordError(`${quiz._count.attempts} attempt(s) exist; deleting would erase students' results. Close the quiz instead.`, 409);
    }
    await prisma.quiz.delete({ where: { id: quizId } });
    return NextResponse.json({ ok: true });
  });
}
