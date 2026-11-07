import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { LEVELS } from '@/lib/practice/progression';

type Ctx = { params: Promise<{ syllabusId: string }> };
/** Returns the student's private syllabus hierarchy and independent tier mastery. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;
  if (process.env.PRACTICE_TIER_ENABLED !== 'true') return NextResponse.json({ error: 'Feature disabled' }, { status: 404 });
  const { syllabusId } = await ctx.params;
  const studentId = auth.user.student!.id;
  const syllabus = await prisma.courseSyllabus.findFirst({ where: { id: syllabusId, studentId },
    include: { modules: { orderBy: { orderIndex: 'asc' }, include: { topics: { orderBy: { orderIndex: 'asc' }, include: { topicMastery: { where: { studentId } } } } } } } });
  if (!syllabus) return NextResponse.json({ error: 'Syllabus not found' }, { status: 404 });
  // Supplementary generated-quiz results: never modify TopicMastery or tier locks.
  // Require quiz, question, syllabus, and attempt to belong to the same student.
  const revisionRows = await prisma.quizResponse.findMany({
    where: {
      attempt: { studentId, quiz: { syllabusId: syllabus.id, ownerStudentId: studentId, isAIGenerated: true, OR: [{ sessionKind: 'generated' }, { sessionKind: null }] } },
      question: { syllabusTopicId: { not: null } },
    },
    select: {
      isCorrect: true,
      attempt: { select: { createdAt: true, quiz: { select: { syllabusId: true } } } },
      question: { select: { syllabusTopicId: true, syllabusTopic: { select: { module: { select: { syllabusId: true } } } } } },
    },
  });
  const revisionStats = new Map<string, { attempts: number; correct: number; lastAt: string | null }>();
  for (const row of revisionRows) {
    const topicId = row.question.syllabusTopicId;
    if (!topicId || row.question.syllabusTopic?.module.syllabusId !== syllabus.id || row.attempt.quiz.syllabusId !== syllabus.id) continue;
    const prev = revisionStats.get(topicId) ?? { attempts: 0, correct: 0, lastAt: null };
    const timestamp = row.attempt.createdAt.toISOString();
    revisionStats.set(topicId, { attempts: prev.attempts + 1, correct: prev.correct + Number(row.isCorrect), lastAt: !prev.lastAt || timestamp > prev.lastAt ? timestamp : prev.lastAt });
  }
  const graph = syllabus.modules.map(m => ({ id: m.id, name: m.name, description: m.description, orderIndex: m.orderIndex,
    estimatedMinutes: m.estimatedMinutes, actualMinutes: m.actualMinutes, parseConfidence: m.parseConfidence,
    topics: m.topics.map(t => ({ id: t.id, name: t.name, description: t.description, orderIndex: t.orderIndex,
      depth: t.depth, parentTopicId: t.parentTopicId, prerequisiteIds: t.prerequisiteIds, levelTarget: t.levelTarget,
      estimatedMinutes: t.estimatedMinutes, actualMinutes: t.actualMinutes, parseConfidence: t.parseConfidence,
      generatedQuiz: (() => { const v = revisionStats.get(t.id); return v ? { answered: v.attempts, correct: v.correct, percentage: Math.round(100 * v.correct / v.attempts), lastAt: v.lastAt } : null; })(),
      mastery: Object.fromEntries(LEVELS.map(level => [level, t.topicMastery.find(x => x.difficulty === level)?.masteryScore ?? 0])),
      attemptCounts: Object.fromEntries(LEVELS.map(level => [level, t.topicMastery.find(x => x.difficulty === level)?.attemptCount ?? 0])) })) }));
  return NextResponse.json({ syllabusId: syllabus.id, version: syllabus.version, active: syllabus.active,
    overallConfidence: null, modules: graph });
}
