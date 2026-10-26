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

    const latestRisk = student.riskAssessments[0];
    const totalAtt = student.attendance.length;
    const presentAtt = student.attendance.filter(
      (a) => a.status === 'PRESENT' || a.status === 'LATE'
    ).length;
    const attendance = totalAtt
      ? Math.round((presentAtt / totalAtt) * 100)
      : student.digitalTwin
      ? Math.round(student.digitalTwin.attendanceScore)
      : 88;

    const predictedGpa = latestRisk?.predictedGPA ? latestRisk.predictedGPA.toFixed(2) : '3.80';
    const gpa = (Number(predictedGpa) - 0.1).toFixed(2);

    return NextResponse.json({
      data: {
        id: student.id,
        rollNumber: student.rollNumber,
        name: student.fullName,
        department: student.department,
        academicHealth: student.digitalTwin ? Math.round(student.digitalTwin.academicHealth) : 80,
        riskLevel: latestRisk?.riskLevel || 'LOW',
        riskScore: latestRisk ? Math.round(latestRisk.riskScore) : 20,
        attendance,
        engagement: student.digitalTwin ? Math.round(student.digitalTwin.engagementScore) : 80,
        learningVelocity: student.digitalTwin ? Math.round(student.digitalTwin.learningVelocity * 100) : 75,
        gpa,
        predictedGpa,
        factors: latestRisk?.factors || {},
        explanation: latestRisk?.explanation || {},
      },
    });
  } catch (error) {
    console.error('[FACULTY_STUDENT_DRILLDOWN_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch student details' }, { status: 500 });
  }
}
