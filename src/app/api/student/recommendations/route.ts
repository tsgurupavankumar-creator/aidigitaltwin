import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';
import { scheduleDay, taskFor } from '@/lib/twin/study-plan';

/** The recommendations from the latest review (not every review ever), with concept and reason. */
export async function GET() {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;
  try {
    const studentId = auth.user.student!.id;
    const latest = await prisma.recommendation.findFirst({ where: { studentId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    if (!latest) return NextResponse.json({ data: [] });
    const recommendations = await prisma.recommendation.findMany({
      // One review saves its recommendations together; take that batch.
      where: { studentId, createdAt: { gte: new Date(latest.createdAt.getTime() - 60_000) } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, reason: true, actionType: true, confidence: true, appliedAt: true, createdAt: true, concept: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ data: recommendations });
  } catch (error) {
    console.error('[STUDENT_RECOMMENDATIONS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
  }
}

/** Adds the recommendation's concept to the study plan once, on the least busy day of the next week. */
export async function POST(req: NextRequest) {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;
  try {
    const parsed = z.object({ recommendationId: z.string().min(1).max(128) }).strict().safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'recommendationId is required' }, { status: 400 });
    const studentId = auth.user.student!.id;
    const recommendation = await prisma.recommendation.findFirst({
      where: { id: parsed.data.recommendationId, studentId },
      select: { id: true, conceptId: true, appliedAt: true, title: true },
    });
    if (!recommendation) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
    if (!recommendation.conceptId) {
      return NextResponse.json({ error: 'This is general advice, so there is no concept to add to your study plan.' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      let plan = await tx.studyPlan.findFirst({ where: { studentId }, orderBy: { createdAt: 'desc' }, select: { id: true } });
      if (!plan) plan = await tx.studyPlan.create({ data: { studentId, title: 'My study plan' }, select: { id: true } });
      const existing = await tx.studyTask.findFirst({ where: { studyPlanId: plan.id, recommendationId: recommendation.id }, select: { id: true, scheduledFor: true } });
      if (existing) return { task: existing, alreadyAdded: true };
      const mastery = await tx.conceptMastery.findUnique({ where: { studentId_conceptId: { studentId, conceptId: recommendation.conceptId! } }, select: { masteryScore: true } });
      const planned = await tx.studyTask.findMany({ where: { studyPlanId: plan.id }, select: { scheduledFor: true, estimatedMins: true, completed: true } });
      const { priority, estimatedMins } = taskFor(mastery?.masteryScore ?? null);
      const task = await tx.studyTask.create({
        data: { studyPlanId: plan.id, conceptId: recommendation.conceptId!, recommendationId: recommendation.id, priority, estimatedMins, scheduledFor: scheduleDay(planned) },
        select: { id: true, scheduledFor: true },
      });
      await tx.recommendation.update({ where: { id: recommendation.id }, data: { appliedAt: new Date() } });
      return { task, alreadyAdded: false };
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[STUDENT_RECOMMENDATIONS_POST_ERROR]', error);
    return NextResponse.json({ error: 'Failed to apply recommendation' }, { status: 500 });
  }
}
