import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ studentId: string }>;
}

export async function GET(_req: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { studentId } = await context.params;
  const requester = await prisma.user.findUnique({
    where: { id: session.id },
    include: { student: true },
  });
  if (!requester || requester.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (requester.role === 'STUDENT') {
    if (requester.student?.id !== studentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else if (requester.role === 'FACULTY') {
    const faculty = await prisma.faculty.findUnique({
      where: { userId: session.id },
      select: { id: true },
    });
    if (!faculty) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, course: { facultyId: faculty.id } },
      select: { id: true },
    });
    if (!enrollment) return NextResponse.json({ error: 'Not your student' }, { status: 403 });
  } else if (requester.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const data = await prisma.agentLog.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ data });
}
