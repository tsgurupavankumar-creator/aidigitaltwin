import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOwnCourse } from '@/lib/twin/access';
import { handle } from '@/lib/twin/http';

type Ctx = { params: Promise<{ courseId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle('CONCEPTS_GET', async () => {
    const { courseId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const concepts = await prisma.concept.findMany({ where: { courseId }, orderBy: { orderIndex: 'asc' }, select: { id: true, name: true, difficulty: true } });
    return NextResponse.json({ concepts });
  });
}
