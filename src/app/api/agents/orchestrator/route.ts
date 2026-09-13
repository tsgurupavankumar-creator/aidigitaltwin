import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { orchestrate } from '@/lib/agents/orchestrator';
import type { StudentEvent } from '@/lib/agents/types';

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const requester = await prisma.user.findUnique({ where: { id: session.id }, include: { student: true } });
  if (!requester || requester.status !== 'ACTIVE') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as { studentId?: string; event?: StudentEvent };
    if (!body.studentId || !body.event) return NextResponse.json({ error: 'studentId and event are required' }, { status: 400 });
    if (requester.role === 'STUDENT' && requester.student?.id !== body.studentId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json(await orchestrate(body.studentId, body.event));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Agent orchestration failed' }, { status: 500 });
  }
}
