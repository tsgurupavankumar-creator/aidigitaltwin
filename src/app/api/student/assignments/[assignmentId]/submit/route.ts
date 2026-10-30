import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/twin/access';
import { handle } from '@/lib/twin/http';
import { submitAssignment } from '@/lib/twin/records';
import { scheduleTwinSync } from '@/lib/twin/sync';

type Ctx = { params: Promise<{ assignmentId: string }> };

/** Hands in the student's work (a typed answer and/or a link); LATE after the due date. Faculty grade it. */
export async function POST(req: NextRequest, ctx: Ctx) {
  return handle('ASSIGNMENT_SUBMIT_POST', async () => {
    const { assignmentId } = await ctx.params;
    const auth = await requireUser('student');
    if (!auth.ok) return auth.error;
    const studentId = auth.user.student?.id;
    if (!studentId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = (await req.json().catch(() => ({}))) as { content?: unknown; link?: unknown };
    const work = { content: typeof body.content === 'string' ? body.content : null, link: typeof body.link === 'string' ? body.link : null };
    const result = await prisma.$transaction((tx) => submitAssignment(tx, studentId, assignmentId, work));
    const twinUpdatesQueued = scheduleTwinSync(result.tasks);
    return NextResponse.json({ submission: result.submission, twinUpdatesQueued }, { status: 201 });
  });
}
