import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

/** Students update year, semester and section. Name and roll number are identity (checked
 *  against the roster at signup), so they are not editable here. */
const body = z.object({
  year: z.number().int().min(1).max(6).optional(),
  semester: z.number().int().min(1).max(12).optional(),
  section: z.string().trim().min(1).max(20).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid details' }, { status: 400 });
  const updated = await prisma.student.update({ where: { id: auth.user.student!.id }, data: parsed.data, select: { year: true, semester: true, section: true } });
  return NextResponse.json({ data: updated });
}
