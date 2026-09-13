import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { orchestrate } from '@/lib/agents/orchestrator';
import type { StudentEvent } from '@/lib/agents/types';

const events = new Set<StudentEvent>(['quiz_attempted', 'assignment_submitted', 'attendance_marked', 'weekly_review', 'manual_trigger']);

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as { studentId?: string; event?: string };
    if (!body.studentId || !body.event || !events.has(body.event as StudentEvent)) {
      return NextResponse.json({ error: 'studentId and a valid event are required' }, { status: 400 });
    }

    const requester = await prisma.user.findUnique({ where: { id: session.id }, include: { student: true } });
    if (!requester || requester.status !== 'ACTIVE') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (requester.role === 'STUDENT' && requester.student?.id !== body.studentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await orchestrate(body.studentId, body.event as StudentEvent);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[AGENT_ORCHESTRATION_ERROR]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Agent orchestration failed' }, { status: 500 });
  }
}
