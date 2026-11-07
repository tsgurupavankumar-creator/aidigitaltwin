import { attendanceRate, markRangeOf } from '@/lib/twin/attendance-rate';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;

  try {
    const studentId = params.id;

    // Verify student is enrolled in at least one course taught by this faculty
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        enrollments: { some: { course: { facultyId: auth.user.faculty!.id } } },
      },
      include: {
        digitalTwin: true,
        riskAssessments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        attendance: {
          select: { status: true },
        },
        enrollments: {
          include: { course: true },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found in your assigned courses' }, { status: 404 });
    }

    // Real values only; null = no data yet (shown as "—"), never a default.
    const latestRisk = student.riskAssessments[0];
    const twin = student.digitalTwin;

    return NextResponse.json({
      data: {
        id: student.id,
        rollNumber: student.rollNumber,
        name: student.fullName,
        department: student.department,
        academicHealth: twin ? Math.round(twin.academicHealth) : null,
        riskLevel: latestRisk?.riskLevel ?? null,
        riskScore: latestRisk ? Math.round(latestRisk.riskScore) : null,
        attendance: attendanceRate(student.attendance.map((a) => a.status)),
        engagement: twin ? Math.round(twin.engagementScore) : null,
        learningVelocity: twin ? Math.round(twin.learningVelocity * 100) : null,
        predictedGpa: latestRisk?.predictedGPA ?? null,
        markRange: markRangeOf(latestRisk?.factors),
        assessedAt: latestRisk?.createdAt ?? null,
        factors: latestRisk?.factors || {},
        explanation: latestRisk?.explanation || {},
      },
    });
  } catch (error) {
    console.error('[FACULTY_STUDENT_DRILLDOWN_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch student details' }, { status: 500 });
  }
}
