import { attendanceRate, markRangeOf } from '@/lib/twin/attendance-rate';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
export async function GET() {
  const auth = await requireRole('faculty'); if ('error' in auth) return auth.error;
  const rows = await prisma.student.findMany({ where: { enrollments: { some: { course: { facultyId: auth.user.faculty!.id } } } }, select: { id: true, rollNumber: true, fullName: true, department: true, year: true, semester: true, riskAssessments: { orderBy: { createdAt: 'desc' }, take: 1 }, digitalTwin: true, attendance: { select: { status: true } } }, orderBy: { fullName: 'asc' } });
  // Attendance from records with the same rule everywhere (EXCUSED left out), so every page agrees.
  const data = rows.map(({ attendance, ...s }) => ({ ...s, attendanceRate: attendanceRate(attendance.map((a) => a.status)), markRange: markRangeOf(s.riskAssessments[0]?.factors) }));
  return NextResponse.json({ data });
}