import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { scheduleTwinSync } from '@/lib/twin/sync';

interface RouteContext {
  params: Promise<{ courseId: string; assignmentId: string }>;
}

const bodySchema = z.object({
  grades: z.array(z.object({
    studentId: z.string().min(1),
    marksObtained: z.number().finite().min(0),
  }).strict()).min(1),
}).strict();

export async function PUT(req: NextRequest, context: RouteContext) {
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;

  try {
    const input = bodySchema.parse(await req.json());
    const { courseId, assignmentId } = await context.params;
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, facultyId: true } });
    if (!course || course.facultyId !== auth.user.faculty?.id) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, courseId: true, maxMarks: true },
    });
    if (!assignment || assignment.courseId !== courseId) {
      return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 });
    }
    if (input.grades.some((grade) => grade.marksObtained > assignment.maxMarks)) {
      return NextResponse.json({ error: `Marks cannot exceed the maximum of ${assignment.maxMarks}.` }, { status: 400 });
    }

    const enrollments = await prisma.enrollment.findMany({ where: { courseId }, select: { studentId: true } });
    const enrolledStudentIds = new Set(enrollments.map((enrollment) => enrollment.studentId));
    if (input.grades.some((grade) => !enrolledStudentIds.has(grade.studentId))) {
      return NextResponse.json({ error: 'Grade record includes a student not enrolled in this course.' }, { status: 400 });
    }

    for (const grade of input.grades) {
      await prisma.submission.upsert({
        where: { studentId_assignmentId: { studentId: grade.studentId, assignmentId } },
        create: {
          studentId: grade.studentId,
          assignmentId,
          marksObtained: grade.marksObtained,
          status: 'GRADED',
        },
        update: { marksObtained: grade.marksObtained, status: 'GRADED' },
      });
    }
    const twinUpdatesQueued = scheduleTwinSync(input.grades.map((grade) => ({
      studentId: grade.studentId,
      event: 'assignment_submitted' as const,
      sourceKey: `grade:${assignmentId}:${grade.studentId}:${grade.marksObtained}`,
    })));

    return NextResponse.json({ saved: input.grades.length, twinUpdatesQueued });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid grades.' }, { status: 400 });
    }
    console.error('[FACULTY_GRADES_SAVE_ERROR]', error);
    return NextResponse.json({ error: 'Unable to save grades.' }, { status: 500 });
  }
}
