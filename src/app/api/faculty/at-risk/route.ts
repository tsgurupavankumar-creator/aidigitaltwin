import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { attendanceRate, markRangeOf } from '@/lib/twin/attendance-rate';
import { isAtRiskLevel } from '@/lib/risk/at-risk';

export async function GET() {
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;

  try {
    const facultyId = auth.user.faculty!.id;

    // Get all students enrolled in this faculty's courses
    const students = await prisma.student.findMany({
      where: {
        enrollments: {
          some: { course: { facultyId } },
        },
      },
      include: {
        riskAssessments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        digitalTwin: true,
        attendance: {
          select: { status: true },
        },
        enrollments: {
          include: { course: { select: { code: true, name: true } } },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    // At risk = latest assessment HIGH or CRITICAL (see src/lib/risk/at-risk.ts).
    const atRiskStudents = students
      .filter((s) => isAtRiskLevel(s.riskAssessments[0]?.riskLevel))
      .map((s) => {
        const latestRisk = s.riskAssessments[0]!;

        return {
          id: s.id,
          rollNumber: s.rollNumber,
          name: s.fullName,
          department: s.department,
          riskLevel: latestRisk!.riskLevel,
          riskScore: Math.round(latestRisk.riskScore),
          predictedGpa: latestRisk.predictedGPA ?? null,
          markRange: markRangeOf(latestRisk.factors),
          academicHealth: s.digitalTwin ? Math.round(s.digitalTwin.academicHealth) : null,
          attendance: attendanceRate(s.attendance.map((a) => a.status)),
          assessedAt: latestRisk.createdAt,
          factors: latestRisk?.factors || {},
          explanation: latestRisk?.explanation || {},
          courses: s.enrollments.map((e) => e.course.code),
        };
      });

    return NextResponse.json({ data: atRiskStudents });
  } catch (error) {
    console.error('[FACULTY_AT_RISK_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch at-risk cohort' }, { status: 500 });
  }
}
