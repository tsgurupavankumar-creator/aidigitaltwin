import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { Priority } from '@prisma/client';
import { z } from 'zod';

export async function GET() {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;

  try {
    const recommendations = await prisma.recommendation.findMany({
      where: { studentId: auth.user.student!.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: recommendations });
  } catch (error) {
    console.error('[STUDENT_RECOMMENDATIONS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;

  try {
    const parsed = z.object({ recommendationId: z.string().min(1).max(128) }).strict().safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'recommendationId is required' }, { status: 400 });
    const { recommendationId } = parsed.data;

    const recommendation = await prisma.recommendation.findFirst({
      where: { id: recommendationId, studentId: auth.user.student!.id },
    });

    if (!recommendation) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
    }

    // Ensure student has an active study plan to attach a task to
    let plan = await prisma.studyPlan.findFirst({
      where: { studentId: auth.user.student!.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!plan) {
      plan = await prisma.studyPlan.create({
        data: {
          studentId: auth.user.student!.id,
          title: 'Dynamic Mastery Plan',
        },
      });
    }

    // Find a relevant concept or first concept for this student's enrolled courses
    const concept = await prisma.concept.findFirst({
      where: { course: { enrollments: { some: { studentId: auth.user.student!.id } } } },
    });

    if (concept) {
      await prisma.studyTask.create({
        data: {
          studyPlanId: plan.id,
          conceptId: concept.id,
          priority: Priority.HIGH,
          estimatedMins: 30,
        },
      });
    }

    return NextResponse.json({ success: true, message: 'Recommendation applied to study plan' });
  } catch (error) {
    console.error('[STUDENT_RECOMMENDATIONS_POST_ERROR]', error);
    return NextResponse.json({ error: 'Failed to apply recommendation' }, { status: 500 });
  }
}
