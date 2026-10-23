import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { requireOwnCourse } from '@/lib/twin/access';
import { MAX_CSV_BYTES } from '@/lib/twin/csv';
import { handle } from '@/lib/twin/http';
import { importCsv } from '@/lib/twin/import';
import { scheduleTwinSync } from '@/lib/twin/sync';

type Ctx = { params: Promise<{ courseId: string }> };

const bodySchema = z.object({
  kind: z.enum(['attendance', 'grades']),
  csv: z.string().min(1).max(MAX_CSV_BYTES),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  return handle('IMPORT_POST', async () => {
    const { courseId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const limit = checkRateLimit(`import:${access.facultyId}`, { max: 20, windowMs: 15 * 60 * 1000 });
    if (!limit.allowed) return NextResponse.json({ error: 'Too many imports; try again shortly.', retryAfterMs: limit.retryAfterMs }, { status: 429 });
    const { kind, csv } = bodySchema.parse(await req.json());
    const result = await importCsv(prisma, courseId, kind, csv);
    const twinUpdatesQueued = scheduleTwinSync(result.tasks);
    return NextResponse.json({ kind, rows: result.rows, saved: result.saved, unchanged: result.unchanged, lecturesCreated: result.lecturesCreated, twinUpdatesQueued });
  });
}
