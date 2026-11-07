import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
export async function GET() {
  const auth = await requireRole('student'); if ('error' in auth) return auth.error;
  const data = await prisma.riskAssessment.findFirst({ where: { studentId: auth.user.student!.id }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ data });
}