import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { requireOwnCourse } from '@/lib/twin/access';
import { COURSE_SUMMARY, refreshCourseInsight } from '@/lib/twin/class-insights';
import { handle } from '@/lib/twin/http';

type Ctx = { params: Promise<{ courseId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle('INSIGHTS_GET', async () => {
    const { courseId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const row = await prisma.classInsight.findFirst({ where: { courseId, insightType: COURSE_SUMMARY }, select: { data: true, updatedAt: true } });
    return NextResponse.json({ insight: row?.data ?? null, updatedAt: row?.updatedAt ?? null });
  });
}

/** Recompute now (it also refreshes automatically after every data change). */
export async function POST(_req: NextRequest, ctx: Ctx) {
  return handle('INSIGHTS_POST', async () => {
    const { courseId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const limit = checkRateLimit(`insight:${courseId}`, { max: 30, windowMs: 15 * 60 * 1000 });
    if (!limit.allowed) return NextResponse.json({ error: 'Too many refreshes; try again shortly.' }, { status: 429 });
    const insight = await refreshCourseInsight(prisma, courseId);
    return NextResponse.json({ insight });
  });
}
