import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

const body = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  department: z.string().trim().min(2).max(120).optional(),
  designation: z.string().trim().min(2).max(120).optional(),
});

/** Faculty edit their own name, department and designation. */
export async function PATCH(req: NextRequest) {
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid details' }, { status: 400 });
  const updated = await prisma.faculty.update({ where: { id: auth.user.faculty!.id }, data: parsed.data, select: { fullName: true, department: true, designation: true } });
  return NextResponse.json({ data: updated });
}
