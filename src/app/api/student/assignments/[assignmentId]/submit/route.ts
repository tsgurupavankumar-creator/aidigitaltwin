import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/twin/access';
import { handle } from '@/lib/twin/http';
import { submitAssignment } from '@/lib/twin/records';
import { scheduleTwinSync } from '@/lib/twin/sync';

type Ctx = { params: Promise<{ assignmentId: string }> };

/** Marks the assignment as handed in (LATE after the due date). Grading is done by faculty. */
export async function POST(_req: NextRequest, ctx: Ctx) {
  return handle('ASSIGNMENT_SUBMIT_POST', async () => {
    const { assignmentId } = await ctx.params;
    const auth = await requireUser('student');
    if (!auth.ok) return auth.error;
    const studentId = auth.user.student?.id;
    if (!studentId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const result = await prisma.$transaction((tx) => submitAssignment(tx, studentId, assignmentId));
    const twinUpdatesQueued = scheduleTwinSync(result.tasks);
    return NextResponse.json({ submission: result.submission, twinUpdatesQueued }, { status: 201 });
  });
}
