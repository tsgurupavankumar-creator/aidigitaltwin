import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { PracticeSubmitSchema } from '@/lib/validation/practice';
import { availability, verifyStart, withinTime } from '@/lib/twin/quiz-rules';
import { recordQuizAttempt, RecordError } from '@/lib/twin/records';
import { topicProgress } from '@/lib/practice/access';
import { scheduleTwinSync } from '@/lib/twin/sync';
import { Prisma } from '@prisma/client';
/** Grades a private practice quiz and updates tier mastery atomically. */
export async function POST(req: NextRequest) {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;
  if (process.env.PRACTICE_TIER_ENABLED !== 'true') return NextResponse.json({ error: 'Feature disabled' }, { status: 404 });
  const studentId = auth.user.student!.id;
  const input = PracticeSubmitSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Invalid submission' }, { status: 400 });
  const { quizId, answers, startToken } = input.data;
  const quiz = await prisma.quiz.findFirst({ where: { id: quizId, ownerStudentId: studentId, sessionKind: 'practice' },
    select: { id: true, durationMins: true, maxAttempts: true, opensAt: true, closesAt: true, isClosed: true, questions: { select: { syllabusTopicId: true } } } });
  if (!quiz) return NextResponse.json({ error: 'Practice quiz not found' }, { status: 404 });
  const startedAt = verifyStart(startToken, quizId, studentId);
  if (startedAt === null || !withinTime(startedAt, quiz.durationMins)) return NextResponse.json({ error: 'Practice session expired' }, { status: 409 });
  const used = await prisma.quizAttempt.count({ where: { studentId, quizId } });
  if (!availability(quiz, used).open) return NextResponse.json({ error: 'Practice already submitted' }, { status: 409 });
  try {
    const elapsedSec = Math.max(0, Math.min(quiz.durationMins * 60, Math.floor((Date.now() - startedAt) / 1000)));
    const result = await prisma.$transaction(async tx => recordQuizAttempt(tx, studentId, quizId, answers, elapsedSec), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    scheduleTwinSync(result.tasks);
    const topicId = quiz.questions[0]?.syllabusTopicId;
    const progress = topicId ? await topicProgress(studentId, topicId) : null;
    return NextResponse.json({ attemptId: result.attemptId, score: result.score, correctCount: result.score,
      totalCount: result.total, percentage: result.percentage, ...progress }, { status: 201 });
  } catch (e) {
    if (e instanceof RecordError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2002' || e.code === 'P2034')) return NextResponse.json({ error: 'Practice already submitted; retry safely' }, { status: 409 });
    return NextResponse.json({ error: 'Unable to submit practice' }, { status: 500 });
  }
}
