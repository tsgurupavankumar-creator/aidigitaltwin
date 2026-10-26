import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
export async function GET() {
  const auth = await requireRole('student'); if ('error' in auth) return auth.error;
  const data = await prisma.conceptMastery.findMany({ where: { studentId: auth.user.student!.id, masteryScore: { lt: 70 } }, include: { concept: { select: { id: true, name: true, difficulty: true, courseId: true } } }, orderBy: { masteryScore: 'asc' } });
  return NextResponse.json({ data });
}