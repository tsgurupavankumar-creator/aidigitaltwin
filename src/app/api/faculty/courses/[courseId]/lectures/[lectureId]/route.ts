import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwnCourse } from '@/lib/twin/access';
import { handle } from '@/lib/twin/http';
import { deleteLecture, updateLecture } from '@/lib/twin/manage';

type Ctx = { params: Promise<{ courseId: string; lectureId: string }> };
const body = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), time: z.string().trim().min(1).max(20).optional(), room: z.string().trim().min(1).max(60).optional() });

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle('LECTURE_PATCH', async () => {
    const { courseId, lectureId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    await updateLecture(courseId, lectureId, body.parse(await req.json()));
    return NextResponse.json({ ok: true });
  });
}

/** Also removes this lecture's attendance marks; affected twins are recomputed. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle('LECTURE_DELETE', async () => {
    const { courseId, lectureId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    return NextResponse.json(await deleteLecture(courseId, lectureId));
  });
}
