import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOwnCourse } from '@/lib/twin/access';
import { handle } from '@/lib/twin/http';
import { ConceptError, importConcepts } from '@/lib/twin/concepts';

type Ctx = { params: Promise<{ courseId: string }> };
const MAX_BYTES = 200_000;

/** CSV: name, topic, difficulty (1-5), prerequisites ("A; B"). All rows are saved or none. */
export async function POST(req: NextRequest, ctx: Ctx) {
  return handle('CONCEPTS_IMPORT', async () => {
    const { courseId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const csv = await req.text();
    if (!csv.trim()) return NextResponse.json({ error: 'The file is empty.' }, { status: 400 });
    if (csv.length > MAX_BYTES) return NextResponse.json({ error: 'The file is too large (max 200 KB).' }, { status: 413 });
    try {
      const result = await prisma.$transaction((tx) => importConcepts(tx, courseId, csv), { timeout: 30_000 });
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof ConceptError) return NextResponse.json({ error: error.message }, { status: error.status });
      if (error instanceof Error && /header|column/i.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 });
      throw error;
    }
  });
}
