import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

export async function GET() {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;

  try {
    const alerts = await prisma.alert.findMany({
      where: { studentId: auth.user.student!.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: alerts });
  } catch (error) {
    console.error('[STUDENT_ALERTS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;

  try {
    const parsed = z.object({ alertId: z.string().min(1).max(128), isRead: z.boolean().optional() }).strict().safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'alertId and optional boolean isRead are required' }, { status: 400 });
    const { alertId, isRead } = parsed.data;

    const alert = await prisma.alert.findFirst({
      where: { id: alertId, studentId: auth.user.student!.id },
    });

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    const updated = await prisma.alert.update({
      where: { id: alertId },
      data: { isRead: isRead ?? true },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('[STUDENT_ALERTS_PATCH_ERROR]', error);
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
  }
}
