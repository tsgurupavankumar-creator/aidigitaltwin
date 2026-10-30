import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOwnCourse } from '@/lib/twin/access';
import { handle } from '@/lib/twin/http';
import { ConceptError, conceptInput, createConcept, listConcepts } from '@/lib/twin/concepts';

type Ctx = { params: Promise<{ courseId: string }> };

/** Concepts of the course, with topic, difficulty, prerequisites and how much depends on each. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle('CONCEPTS_GET', async () => {
    const { courseId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    return NextResponse.json({ concepts: await listConcepts(prisma, courseId) });
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  return handle('CONCEPTS_CREATE', async () => {
    const { courseId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const parsed = conceptInput.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid concept' }, { status: 400 });
    try {
      const created = await prisma.$transaction((tx) => createConcept(tx, courseId, parsed.data));
      return NextResponse.json({ concept: created }, { status: 201 });
    } catch (error) {
      if (error instanceof ConceptError) return NextResponse.json({ error: error.message }, { status: error.status });
      throw error;
    }
  });
}
