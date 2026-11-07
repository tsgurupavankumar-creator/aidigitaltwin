import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
export async function GET() {
  const auth = await requireRole('faculty'); if ('error' in auth) return auth.error;
  const data = await prisma.classInsight.findMany({ where: { facultyId: auth.user.faculty!.id }, include: { course: { select: { code: true, name: true } } }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ data });
}