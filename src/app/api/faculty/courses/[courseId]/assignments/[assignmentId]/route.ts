import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwnCourse } from '@/lib/twin/access';
import { handle } from '@/lib/twin/http';
import { deleteAssignment, updateAssignment } from '@/lib/twin/manage';

type Ctx = { params: Promise<{ courseId: string; assignmentId: string }> };
const body = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  maxMarks: z.number().positive().max(1000).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle('ASSIGNMENT_PATCH', async () => {
    const { courseId, assignmentId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    return NextResponse.json(await updateAssignment(courseId, assignmentId, body.parse(await req.json())));
  });
}

/** Refused once any submission is graded. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle('ASSIGNMENT_DELETE', async () => {
    const { courseId, assignmentId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    return NextResponse.json(await deleteAssignment(courseId, assignmentId));
  });
}
