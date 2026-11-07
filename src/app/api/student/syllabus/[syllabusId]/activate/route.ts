import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
type Ctx = { params: Promise<{ syllabusId: string }> };
/** Makes one owned syllabus version active while retaining all historical versions. */
export async function POST(_req: Request, ctx: Ctx) {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;
  if (process.env.PRACTICE_TIER_ENABLED !== 'true') return NextResponse.json({ error: 'Feature disabled' }, { status: 404 });
  const { syllabusId } = await ctx.params;
  const studentId = auth.user.student!.id;
  try {
    const result = await prisma.$transaction(async tx => {
      const target = await tx.courseSyllabus.findFirst({ where: { id: syllabusId, studentId } });
      if (!target) return null;
      await tx.courseSyllabus.updateMany({ where: { studentId, courseId: target.courseId }, data: { active: false } });
      await tx.courseSyllabus.update({ where: { id: target.id }, data: { active: true, archivedAt: null } });
      return target.id;
    });
    return result ? NextResponse.json({ ok: true, syllabusId: result }) : NextResponse.json({ error: 'Syllabus not found' }, { status: 404 });
  } catch { return NextResponse.json({ error: 'Unable to activate syllabus' }, { status: 500 }); }
}
