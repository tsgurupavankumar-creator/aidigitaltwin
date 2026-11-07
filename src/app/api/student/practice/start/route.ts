import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { ownedTopic, topicProgress, prerequisiteBlockers } from '@/lib/practice/access';
import { PracticeSessionRequestSchema } from '@/lib/validation/practice';
import { QuizGenerationRequestSchema, QuizGenerationOutputSchema } from '@/lib/validation/quiz-generation';
import { computeQuestionHash, questionDedupKey } from '@/lib/practice/deduplication';
import { generateGroqQuiz } from '@/lib/quiz/groq-generator';
import { Prisma } from '@prisma/client';
import { checkRateLimit } from '@/lib/auth/rate-limit';

/** Starts a private tier-specific quiz using the existing Groq generator; no canned AI fallback. */
export async function POST(req: NextRequest) {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;
  if (process.env.PRACTICE_TIER_ENABLED !== 'true') return NextResponse.json({ error: 'Feature disabled' }, { status: 404 });
  const studentId = auth.user.student!.id;
  const input = PracticeSessionRequestSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Invalid practice settings' }, { status: 400 });
  const { syllabusTopicId, targetDifficulty, questionCount, overridePrerequisite } = input.data;
  const topic = await ownedTopic(studentId, syllabusTopicId);
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  const progress = await topicProgress(studentId, syllabusTopicId);
  if (!progress.unlockedTiers.includes(targetDifficulty)) return NextResponse.json({ error: 'Tier locked' }, { status: 409 });
  const blockers = await prerequisiteBlockers(studentId, syllabusTopicId);
  if (blockers?.length && !overridePrerequisite) return NextResponse.json({ error: 'PREREQUISITE_UNMET', blockers }, { status: 409 });
  // Per-student quota for costly generation calls (per Node process).
  const quota = checkRateLimit(`ai:practice:${studentId}`, { max: 8, windowMs: 60 * 60 * 1000 });
  if (!quota.allowed) return NextResponse.json({ error: 'AI_QUOTA_EXCEEDED', message: 'Hourly practice-generation limit reached.' }, { status: 429, headers: { 'Retry-After': String(Math.ceil(quota.retryAfterMs / 1000)) } });
  const difficulty = ({ BEGINNER: 'easy', INTERMEDIATE: 'medium', ADVANCED: 'hard' } as const)[targetDifficulty];
  const generationInput = QuizGenerationRequestSchema.parse({ courseId: topic.module.syllabus.courseId,
    syllabusId: topic.module.syllabusId, studentId, selectedTopicIds: [topic.id], questionCount,
    questionTypes: ['mcq'], difficulty, targetDifficulty, mode: 'practice', syllabusTopicId });
  // On a database-level duplicate race, regenerate and retry once.
  for (let collisionAttempt = 0; collisionAttempt < 2; collisionAttempt++) {
  let questions: ReturnType<typeof QuizGenerationOutputSchema.parse>['questions'];
  try {
    questions = QuizGenerationOutputSchema.parse({ questions: await generateGroqQuiz(generationInput, [{ id: topic.id, name: topic.name }], studentId) }).questions;
    if (questions.length !== questionCount || questions.some(q => q.syllabusTopicId !== topic.id)) {
      return NextResponse.json({ error: 'Invalid generated questions' }, { status: 502 });
    }
  } catch { return NextResponse.json({ error: 'AI generation unavailable; try again' }, { status: 503 }); }
  try {
    const created = await prisma.$transaction(async tx => {
      const fresh = await tx.courseSyllabus.findFirst({ where: { id: topic.module.syllabusId, studentId, active: true }, select: { id: true } });
      if (!fresh) throw new Error('STALE_SYLLABUS');
      const quiz = await tx.quiz.create({ data: { courseId: topic.module.syllabus.courseId, syllabusId: fresh.id,
        ownerStudentId: studentId, title: `${targetDifficulty.toLowerCase()} practice: ${topic.name}`,
        description: 'Personalized syllabus topic practice', isAIGenerated: true, durationMins: Math.max(5, questionCount * 2),
        maxAttempts: 1, sessionKind: 'practice', targetDifficulty } });
      for (const q of questions) {
        const options = q.type === 'mcq' ? q.options : q.type === 'true_false' ? ['true', 'false'] : [];
        const hash = computeQuestionHash(q.prompt, options);
        await tx.question.create({ data: { quizId: quiz.id, syllabusTopicId: topic.id, conceptId: topic.conceptId,
          type: q.type.toUpperCase() as 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER',
          difficulty: ({ easy: 1, medium: 3, hard: 5 } as const)[q.difficulty],
          targetLevel: targetDifficulty, questionHash: hash,
          dedupKey: questionDedupKey(studentId, topic.id, targetDifficulty, hash),
          options: { prompt: q.prompt, choices: options }, correctAnswer: q.correctAnswer } });
      }
      if (blockers?.length && overridePrerequisite) await tx.agentLog.create({ data: { studentId, agentType: 'QUIZ', status: 'COMPLETED',
        triggeredBy: 'student:practice_override', input: { action: 'STUDENT_OVERRIDE_PREREQ', topicId: topic.id },
        output: { blockerIds: blockers.map(b => b.topicId) } } });
      return quiz;
    });
    return NextResponse.json({ quizId: created.id, questions: questions.length }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      if (collisionAttempt === 0) continue;
      return NextResponse.json({ error: 'TOPIC_EXHAUSTED', message: 'Repeated questions detected after regeneration.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Unable to save practice session' }, { status: 500 });
  }
  }
  return NextResponse.json({ error: 'TOPIC_EXHAUSTED' }, { status: 409 });
}
