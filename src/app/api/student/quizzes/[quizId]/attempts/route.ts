import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/twin/access';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { handle } from '@/lib/twin/http';
import { RecordError, recordQuizAttempt } from '@/lib/twin/records';
import { availability, unavailableMessage, verifyStart, withinTime } from '@/lib/twin/quiz-rules';
import { scheduleTwinSync } from '@/lib/twin/sync';

type Ctx = { params: Promise<{ quizId: string }> };

const bodySchema = z.object({ answers: z.record(z.string().max(64), z.string().max(2000)), startToken: z.string().max(200).optional() });

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
    const { answers, startToken } = bodySchema.parse(await req.json());
    const result = await prisma.$transaction(async (tx) => {
      // Server-side rules: open window, attempts left, and the time limit from the signed start.
      const quiz = await tx.quiz.findUnique({ where: { id: quizId }, select: { durationMins: true, maxAttempts: true, opensAt: true, closesAt: true, isClosed: true } });
      if (!quiz) throw new RecordError('Quiz not found', 404);
      const used = await tx.quizAttempt.count({ where: { quizId, studentId } });
      const avail = availability(quiz, used);
      if (!avail.open) throw new RecordError(unavailableMessage(avail.reason!, quiz), 409);
      const startedAt = verifyStart(startToken, quizId, studentId);
      if (startedAt === null) throw new RecordError('Please reopen the quiz and try again.', 400);
      if (!withinTime(startedAt, quiz.durationMins)) throw new RecordError('Time is up for this attempt; it was not accepted.', 409);
      return recordQuizAttempt(tx, studentId, quizId, answers);
    });
    const twinUpdatesQueued = scheduleTwinSync(result.tasks);
    return NextResponse.json({
      attemptId: result.attemptId, score: result.score, total: result.total, percentage: result.percentage,
      results: result.graded.map((g) => ({ questionId: g.questionId, isCorrect: g.isCorrect, correctAnswer: g.correctAnswer })),
      twinUpdatesQueued,
    }, { status: 201 });
  });
}
