import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
export async function GET() {
  const auth = await requireRole('faculty'); if ('error' in auth) return auth.error;
  const data = await prisma.student.findMany({ where: { enrollments: { some: { course: { facultyId: auth.user.faculty!.id } } } }, select: { id: true, rollNumber: true, fullName: true, department: true, year: true, semester: true, riskAssessments: { orderBy: { createdAt: 'desc' }, take: 1 }, digitalTwin: true }, orderBy: { fullName: 'asc' } });
  return NextResponse.json({ data });
}