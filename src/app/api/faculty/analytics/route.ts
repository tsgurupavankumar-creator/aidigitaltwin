import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { cohortAnalytics } from '@/lib/twin/cohort-analytics';

/** Class analytics for the signed-in faculty member's students, from real records only. */
export async function GET() {
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;
  try {
    const facultyId = auth.user.faculty!.id;
    const inMyCourses = { enrollments: { some: { course: { facultyId } } } };
    const since = new Date(Date.now() - 8 * 7 * 86_400_000 - 86_400_000 * 60);
    const [students, interventions, snapshots] = await Promise.all([
      prisma.student.findMany({
        where: inMyCourses,
        select: { id: true, digitalTwin: { select: { academicHealth: true } }, riskAssessments: { orderBy: { createdAt: 'desc' }, take: 1, select: { riskLevel: true } } },
      }),
      prisma.intervention.findMany({ where: { facultyId }, select: { completedAt: true } }),
      prisma.twinSnapshot.findMany({
        where: { student: inMyCourses, createdAt: { gte: since } },
        select: { studentId: true, createdAt: true, academicHealth: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return NextResponse.json({
      data: cohortAnalytics({
        now: new Date(),
        students: students.map((s) => ({ id: s.id, academicHealth: s.digitalTwin?.academicHealth ?? null, riskLevel: s.riskAssessments[0]?.riskLevel ?? null })),
        interventions,
        snapshots,
      }),
    });
  } catch (error) {
    console.error('[FACULTY_ANALYTICS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
