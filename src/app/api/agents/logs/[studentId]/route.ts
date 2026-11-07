import { blockIfPasswordChangeRequired } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, props: { params: Promise<{ studentId: string }> }) {
  const params = await props.params;
  const session = await getAuthSession();
  const mustChange = session?.id ? await blockIfPasswordChangeRequired(session.id) : null;
  if (mustChange) return mustChange;
  if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const requester = await prisma.user.findUnique({ where: { id: session.id }, include: { student: true } });
  if (!requester || requester.status !== 'ACTIVE') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (requester.role === 'STUDENT' && requester.student?.id !== params.studentId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // A faculty member may only read the logs of students enrolled in one of THEIR
  // courses: the same rule as /api/agents/run and /api/faculty/student/[id]. This
  // check was missing, so any faculty member could read any student's agent logs
  // (predictions, reasoning and the features the agents used).
  if (requester.role === 'FACULTY') {
    const faculty = await prisma.faculty.findUnique({ where: { userId: session.id }, select: { id: true } });
    const enrollment = faculty
      ? await prisma.enrollment.findFirst({
          where: { studentId: params.studentId, course: { facultyId: faculty.id } },
          select: { id: true },
        })
      : null;
    if (!enrollment) return NextResponse.json({ error: 'Not your student' }, { status: 403 });
  }

  const logs = await prisma.agentLog.findMany({
    where: { studentId: params.studentId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json(logs);
}
