import { generateGroqQuiz } from '@/lib/quiz/groq-generator';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { QuizGenerationRequestSchema, QuizGenerationOutputSchema } from '@/lib/validation/quiz-generation';
import { checkRateLimit } from '@/lib/auth/rate-limit';

export async function POST(request: NextRequest) {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;
  const studentId = auth.user.student!.id;
  const auditFailure = async (reason: string) => {
    try {
      await prisma.agentLog.create({ data: {
        studentId, agentType: 'QUIZ', status: 'FAILED',
        input: { action: 'ai_quiz_generation', reason },
        output: { errorCode: reason }, triggeredBy: 'student:quiz_generation',
      } });
    } catch { console.error('[QUIZ_GENERATION_AUDIT_UNAVAILABLE]'); }
  };
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'INVALID_JSON', message: 'Request must be JSON.' }, { status: 400 }); }
  const input = QuizGenerationRequestSchema.safeParse(body);
  if (!input.success) return NextResponse.json({ error: 'INVALID_REQUEST', message: input.error.issues[0]?.message }, { status: 400 });
  const data = input.data;
  if (data.studentId !== studentId) return NextResponse.json({ error: 'FORBIDDEN', message: 'Student ID does not match your session.' }, { status: 403 });
  const syllabus = await prisma.courseSyllabus.findFirst({ where: { id: data.syllabusId, studentId, courseId: data.courseId } });
  if (!syllabus) return NextResponse.json({ error: 'NOT_FOUND', message: 'Syllabus does not belong to you.' }, { status: 404 });
  const topics = await prisma.syllabusTopic.findMany({
    where: { id: { in: data.selectedTopicIds }, module: { syllabusId: syllabus.id } }, select: { id: true, name: true },
  });
  if (topics.length !== new Set(data.selectedTopicIds).size || topics.length !== data.selectedTopicIds.length) {
    return NextResponse.json({ error: 'INVALID_TOPICS', message: 'Selected topics must belong to this syllabus and be unique.' }, { status: 400 });
  }

  const linkedTopics = await prisma.syllabusTopic.findMany({
    where: {
      id: { in: data.selectedTopicIds },
      module: { syllabusId: syllabus.id }
    },
    select: { id: true, conceptId: true }
  });

  const conceptByTopic = new Map(
    linkedTopics.map(t => [t.id, t.conceptId])
  );

  // Demo-quality generation defaults to the real Groq integration.
  // The deterministic fixture is allowed ONLY when explicitly opted into stub mode.
  const questions = Array.from({ length: data.questionCount }, (_, index) => {
    const topic = topics[index % topics.length];
    const type = data.questionTypes[index % data.questionTypes.length];
    const difficulty = data.difficulty === 'mixed' ? (['easy', 'medium', 'hard'] as const)[index % 3] : data.difficulty;
    const base = { prompt: `Which statement best describes ${topic.name}? (Question ${index + 1})`, syllabusTopicId: topic.id, conceptId: null, difficulty, explanation: `Review the syllabus topic: ${topic.name}.` };
    if (type === 'mcq') return { ...base, type, options: [`${topic.name} is the subject of this question`, `An unrelated topic`, `Neither option`], correctAnswer: `${topic.name} is the subject of this question` };
    if (type === 'true_false') return { ...base, type, prompt: `True or false: ${topic.name} is included in your selected syllabus.`, correctAnswer: 'true' };
    return { ...base, type: 'short_answer', prompt: `Name the selected topic addressed by this question (${index + 1}).`, correctAnswer: topic.name };
  });
  let generated: unknown = { questions };

  if (process.env.QUIZ_GENERATION_MODE !== 'stub') {
    const quota = checkRateLimit(`ai:quiz:${studentId}`, { max: 8, windowMs: 60 * 60 * 1000 });
    if (!quota.allowed) return NextResponse.json({ error: 'AI_QUOTA_EXCEEDED', message: 'Hourly AI quiz limit reached.' }, { status: 429, headers: { 'Retry-After': String(Math.ceil(quota.retryAfterMs / 1000)) } });
    try {
      generated = {
        questions: await generateGroqQuiz(data, topics, studentId)
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      console.error('[GROQ_QUIZ_GENERATION_FAILED]', reason);
      await auditFailure(reason.slice(0, 120));
      // Preserve rate-limit semantics so the client can distinguish 429 from an outage.
      const rateLimited = reason.startsWith('GROQ_HTTP_429');
      return NextResponse.json({
        error: rateLimited ? 'AI_RATE_LIMITED' : 'AI_GENERATION_FAILED',
        message: rateLimited
          ? 'AI quiz generation is rate limited. Check your Groq quota and retry later.'
          : 'Unable to generate a validated AI quiz. Please retry.'
      }, { status: rateLimited ? 429 : 503 });
    }
  }

  const validated = QuizGenerationOutputSchema.safeParse(generated);
  if (!validated.success) {
    await auditFailure('INVALID_GENERATION_SCHEMA');
    return NextResponse.json({ error: 'INVALID_GENERATION', message: 'Generated questions failed validation.' }, { status: 502 });
  }
  if (validated.data.questions.length !== data.questionCount || validated.data.questions.some((q) => !data.selectedTopicIds.includes(q.syllabusTopicId) || !data.questionTypes.includes(q.type))) {
    await auditFailure('INVALID_GENERATION_TOPIC_OR_COUNT');
    return NextResponse.json({ error: 'INVALID_GENERATION', message: 'Generated question count, types or topics do not match the request.' }, { status: 502 });
  }
  try {
    const quiz = await prisma.$transaction(async (tx) => {
      const created = await tx.quiz.create({ data: {
        courseId: data.courseId, ownerStudentId: studentId, syllabusId: syllabus.id,
        title: `Personalized syllabus quiz - ${new Date().toLocaleDateString('en-GB')}`,
        description: 'Practice quiz generated from your selected syllabus topics.',
        isAIGenerated: true, sessionKind: 'generated', durationMins: Math.max(5, data.questionCount * 2),
      } });
      for (const question of validated.data.questions) {
        await tx.question.create({ data: {
          quizId: created.id, syllabusTopicId: question.syllabusTopicId, conceptId: conceptByTopic.get(question.syllabusTopicId) ?? null,
          type: question.type.toUpperCase() as 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER',
          difficulty: ({ easy: 1, medium: 3, hard: 5 } as const)[question.difficulty],
          options: { prompt: question.prompt, choices: question.type === 'mcq' ? question.options : question.type === 'true_false' ? ['true', 'false'] : [] },
          correctAnswer: question.correctAnswer,
        } });
      }
      return created;
    });
    return NextResponse.json({ quizId: quiz.id }, { status: 201 });
  } catch (error) {
    console.error('[QUIZ_GENERATION_PERSIST_FAILED]', error);
    await auditFailure('QUIZ_PERSISTENCE_FAILED');
    return NextResponse.json({ error: 'SAVE_FAILED', message: 'Unable to save quiz.' }, { status: 500 });
  }
}
