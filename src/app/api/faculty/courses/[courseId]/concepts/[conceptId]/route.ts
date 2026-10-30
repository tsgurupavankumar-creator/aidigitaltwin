import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOwnCourse } from '@/lib/twin/access';
import { handle } from '@/lib/twin/http';
import { ConceptError, conceptInput, deleteConcept, updateConcept } from '@/lib/twin/concepts';

type Ctx = { params: Promise<{ courseId: string; conceptId: string }> };

function conceptError(error: unknown) {
  if (error instanceof ConceptError) return NextResponse.json({ error: error.message }, { status: error.status });
  throw error;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle('CONCEPTS_UPDATE', async () => {
    const { courseId, conceptId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const parsed = conceptInput.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid concept' }, { status: 400 });
    try {
      await prisma.$transaction((tx) => updateConcept(tx, courseId, conceptId, parsed.data));
      return NextResponse.json({ ok: true });
    } catch (error) { return conceptError(error); }
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle('CONCEPTS_DELETE', async () => {
    const { courseId, conceptId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    try {
      await deleteConcept(prisma, courseId, conceptId);
      return NextResponse.json({ ok: true });
    } catch (error) { return conceptError(error); }
  });
}
