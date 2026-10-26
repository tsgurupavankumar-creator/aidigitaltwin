import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { orchestrate } from '@/lib/agents/orchestrator';
import type { StudentEvent } from '@/lib/agents/types';

const bodySchema = z.object({
  studentId: z.string().min(1).max(128),
  event: z.enum(['quiz_attempted', 'assignment_submitted', 'attendance_marked', 'weekly_review', 'manual_trigger']),
}).strict();

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Keep this endpoint's contract aligned with /api/agents/run so callers
    // cannot bypass event validation by choosing the legacy route.
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'studentId and a valid event are required' }, { status: 400 });
    const body = parsed.data;

    // Authorization is checked against the authenticated database user,
    // not values supplied by the client. Students may orchestrate only
    // their own twin; faculty may orchestrate only enrolled students.
    const requester = await prisma.user.findUnique({
      where: { id: session.id },
      include: { student: true },
    });
    if (!requester || requester.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (requester.role === 'STUDENT' && requester.student?.id !== body.studentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (requester.role === 'FACULTY') {
      const faculty = await prisma.faculty.findUnique({
        where: { userId: session.id },
        select: { id: true },
      });
      const enrollment = faculty
        ? await prisma.enrollment.findFirst({
            where: {
              studentId: body.studentId,
              course: { facultyId: faculty.id },
            },
            select: { id: true },
          })
        : null;

      if (!enrollment) return NextResponse.json({ error: 'Not your student' }, { status: 403 });
    }

    const result = await orchestrate(body.studentId, body.event as StudentEvent);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[AGENT_ORCHESTRATION_LEGACY_ERROR]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Agent orchestration failed' },
      { status: 500 }
    );
  }
}
