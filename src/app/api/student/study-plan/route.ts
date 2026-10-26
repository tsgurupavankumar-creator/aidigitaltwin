import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

export async function GET() {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;

  try {
    const studyPlan = await prisma.studyPlan.findFirst({
      where: { studentId: auth.user.student!.id },
      include: {
        tasks: {
          include: {
            concept: {
              select: { id: true, name: true, difficulty: true, courseId: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: studyPlan });
  } catch (error) {
    console.error('[STUDENT_STUDY_PLAN_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch study plan' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;

  try {
    const parsed = z.object({ taskId: z.string().min(1).max(128), completed: z.boolean().optional() }).strict().safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'taskId and optional boolean completed are required' }, { status: 400 });
    const { taskId, completed } = parsed.data;

    const task = await prisma.studyTask.findFirst({
      where: {
        id: taskId,
        studyPlan: { studentId: auth.user.student!.id },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updated = await prisma.studyTask.update({
      where: { id: taskId },
      data: { completed: typeof completed === 'boolean' ? completed : !task.completed },
      include: { concept: true },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('[STUDENT_STUDY_PLAN_PATCH_ERROR]', error);
    return NextResponse.json({ error: 'Failed to update study task' }, { status: 500 });
  }
}
