import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
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
        const latestRisk = s.riskAssessments[0];
        const totalAtt = s.attendance.length;
        const presentAtt = s.attendance.filter(
          (a) => a.status === 'PRESENT' || a.status === 'LATE'
        ).length;
        const attRate = totalAtt ? Math.round((presentAtt / totalAtt) * 100) : s.digitalTwin ? Math.round(s.digitalTwin.attendanceScore) : 85;

        return {
          id: s.id,
          rollNumber: s.rollNumber,
          name: s.fullName,
          department: s.department,
          riskLevel: latestRisk!.riskLevel,
          riskScore: latestRisk ? Math.round(latestRisk.riskScore) : 50,
          predictedGpa: latestRisk?.predictedGPA ? latestRisk.predictedGPA.toFixed(2) : '3.20',
          academicHealth: s.digitalTwin ? Math.round(s.digitalTwin.academicHealth) : 65,
          attendance: attRate,
          lastActivity: 'Recent telemetry update',
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
