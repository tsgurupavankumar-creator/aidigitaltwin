import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { studentId: string } }) {
  const session = await getAuthSession();
  if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const requester = await prisma.user.findUnique({ where: { id: session.id }, include: { student: true } });
  if (!requester || requester.status !== 'ACTIVE') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (requester.role === 'STUDENT' && requester.student?.id !== params.studentId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const logs = await prisma.agentLog.findMany({
    where: { studentId: params.studentId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json(logs);
}
