import { NextRequest, NextResponse } from 'next/server';
import { requireOwnCourse } from '@/lib/twin/access';
import { handle } from '@/lib/twin/http';
import { unenroll } from '@/lib/twin/manage';

type Ctx = { params: Promise<{ courseId: string; studentId: string }> };

/** Removes a student from the course (their past records stay as history). */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle('UNENROLL', async () => {
    const { courseId, studentId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    return NextResponse.json(await unenroll(courseId, studentId));
  });
}
