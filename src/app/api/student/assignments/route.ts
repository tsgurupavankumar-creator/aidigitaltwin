import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/twin/access';
import { handle } from '@/lib/twin/http';

export async function GET() {
  return handle('STUDENT_ASSIGNMENTS_GET', async () => {
    const auth = await requireUser('student');
    if (!auth.ok) return auth.error;
    const studentId = auth.user.student!.id;
    const assignments = await prisma.assignment.findMany({
      where: { course: { enrollments: { some: { studentId } } } },
      orderBy: { dueDate: 'asc' },
      select: {
        id: true, title: true, description: true, maxMarks: true, dueDate: true,
        course: { select: { code: true, name: true } },
        submissions: { where: { studentId }, select: { status: true, marksObtained: true, submittedAt: true, content: true, link: true } },
      },
    });
    return NextResponse.json({
      assignments: assignments.map((a) => ({
        id: a.id, title: a.title, description: a.description, maxMarks: a.maxMarks, dueDate: a.dueDate, course: a.course,
        status: a.submissions[0]?.status ?? null, marksObtained: a.submissions[0]?.marksObtained ?? null, submittedAt: a.submissions[0]?.submittedAt ?? null, content: a.submissions[0]?.content ?? null, link: a.submissions[0]?.link ?? null,
      })),
    });
  });
}
