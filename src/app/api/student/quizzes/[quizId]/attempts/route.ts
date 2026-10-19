import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/twin/access';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { handle } from '@/lib/twin/http';
import { recordQuizAttempt } from '@/lib/twin/records';
import { scheduleTwinSync } from '@/lib/twin/sync';

type Ctx = { params: Promise<{ quizId: string }> };

const bodySchema = z.object({ answers: z.record(z.string().max(64), z.string().max(2000)) });

/** Grades the attempt on the server, stores it, updates concept mastery and queues the twin update. */
export async function POST(req: NextRequest, ctx: Ctx) {
  return handle('QUIZ_ATTEMPT_POST', async () => {
    const { quizId } = await ctx.params;
    const auth = await requireUser('student');
    if (!auth.ok) return auth.error;
    const studentId = auth.user.student?.id;
    if (!studentId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const limit = checkRateLimit(`quiz-attempt:${studentId}`, { max: 20, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) return NextResponse.json({ error: 'Too many attempts; try again later.', retryAfterMs: limit.retryAfterMs }, { status: 429 });
    const { answers } = bodySchema.parse(await req.json());
    const result = await prisma.$transaction((tx) => recordQuizAttempt(tx, studentId, quizId, answers));
    const twinUpdatesQueued = scheduleTwinSync(result.tasks);
    return NextResponse.json({
      attemptId: result.attemptId, score: result.score, total: result.total, percentage: result.percentage,
      results: result.graded.map((g) => ({ questionId: g.questionId, isCorrect: g.isCorrect, correctAnswer: g.correctAnswer })),
      twinUpdatesQueued,
    }, { status: 201 });
  });
}
