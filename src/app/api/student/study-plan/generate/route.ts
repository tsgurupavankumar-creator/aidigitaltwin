import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { StudyPlanOutputSchema } from '@/lib/validation/study-plan';
import { taskFor } from '@/lib/twin/study-plan';

export async function POST(request: NextRequest) {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;
  const studentId = auth.user.student!.id;
  let body: { syllabusId?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ message: 'Invalid JSON.' }, { status: 400 }); }
  const syllabus = await prisma.courseSyllabus.findFirst({
    where: { studentId, ...(body.syllabusId ? { id: body.syllabusId } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  if (!syllabus) return NextResponse.json({ message: 'Upload a syllabus before generating a study plan.' }, { status: 404 });
  const topics = await prisma.syllabusTopic.findMany({ where: { module: { syllabusId: syllabus.id } }, orderBy: [{ module: { orderIndex: 'asc' } }, { orderIndex: 'asc' }] });
  if (topics.length < 3) return NextResponse.json({ message: 'At least three syllabus topics are required.' }, { status: 422 });
  const incorrect = await prisma.quizResponse.findMany({
    where: { isCorrect: false, attempt: { studentId }, question: { syllabusTopic: { module: { syllabusId: syllabus.id } } } },
    select: { question: { select: { syllabusTopicId: true } } },
    orderBy: { createdAt: 'desc' }, take: 100,
  });
  const missed = new Map<string, number>();
  for (const response of incorrect) {
    const id = response.question.syllabusTopicId;
    if (id) missed.set(id, (missed.get(id) ?? 0) + 1);
  }
  const linkedConceptIds = [...new Set(topics.flatMap(t => t.conceptId ? [t.conceptId] : []))];
  const masteries = await prisma.conceptMastery.findMany({
    where: { studentId, conceptId: { in: linkedConceptIds }, assessmentCount: { gt: 0 } },
    select: { conceptId: true, masteryScore: true },
  });
  const masteryByConcept = new Map(masteries.map(m => [m.conceptId, m.masteryScore]));
  // Prioritize demonstrated gaps, then missed quiz questions, then untouched topics.
  const ranked = [...topics].sort((a, b) => {
    const aMastery = a.conceptId ? masteryByConcept.get(a.conceptId) : undefined;
    const bMastery = b.conceptId ? masteryByConcept.get(b.conceptId) : undefined;
    const priority = (mastery: number | undefined, misses: number) =>
      (mastery === undefined ? 0 : Math.max(0, 70 - mastery) * 10) + misses * 2;
    return priority(bMastery, missed.get(b.id) ?? 0) - priority(aMastery, missed.get(a.id) ?? 0);
  });
  const output = StudyPlanOutputSchema.safeParse({ horizon: 'this_week', steps: ranked.slice(0, 5).map((topic, index) => {
    const mastery = topic.conceptId ? masteryByConcept.get(topic.conceptId) : undefined;
    const misses = missed.get(topic.id) ?? 0;
    const task = taskFor(mastery ?? null);
    return {
      title: `Review ${topic.name}`,
      reason: mastery !== undefined && mastery < 70
        ? `Your assessed mastery is ${Math.round(mastery)}%, below the 70% target. Review this concept and practise again.`
        : misses > 0
          ? `You missed ${misses} question(s) on this topic. Review the concept and practice again.`
          : 'Build a stronger foundation in this syllabus topic through review and practice.',
      estimatedMinutes: Math.max(task.estimatedMins, misses > 0 ? 40 : 25),
      syllabusTopicId: topic.id,
      conceptId: topic.conceptId,
      orderIndex: index,
    };
  }) });
  if (!output.success) return NextResponse.json({ message: 'Unable to generate a valid plan.' }, { status: 502 });
  try {
    const plan = await prisma.$transaction(async (tx) => {
      const created = await tx.studyPlan.create({ data: { studentId, syllabusId: syllabus.id, title: 'AI Tutor Plan: Syllabus Review' } });
      await tx.studyTask.createMany({ data: output.data.steps.map((step) => ({
        studyPlanId: created.id, title: step.title, reason: step.reason, orderIndex: step.orderIndex,
        syllabusTopicId: step.syllabusTopicId, conceptId: step.conceptId,
        estimatedMins: step.estimatedMinutes,
        priority: taskFor(step.conceptId ? (masteryByConcept.get(step.conceptId) ?? null) : null).priority,
      })) });
      return created;
    });
    return NextResponse.json({ planId: plan.id, ...output.data });
  } catch (error) {
    console.error('[PLAN_GENERATE_FAILED]', error);
    return NextResponse.json({ message: 'Could not save study plan.' }, { status: 500 });
  }
}
