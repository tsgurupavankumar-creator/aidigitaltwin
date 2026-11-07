import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: auth.user.student!.id },
      select: { course: { select: { id: true, code: true, name: true } } },
      orderBy: { enrolledAt: 'desc' },
    });
    return NextResponse.json({ courses: enrollments.map((entry) => entry.course) });
  } catch {
    return NextResponse.json({ error: 'Unable to load enrolled courses.' }, { status: 500 });
  }
}
