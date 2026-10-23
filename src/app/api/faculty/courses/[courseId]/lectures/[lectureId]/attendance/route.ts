import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { scheduleTwinSync } from '@/lib/twin/sync';

interface RouteContext {
  params: Promise<{ courseId: string; lectureId: string }>;
}

const bodySchema = z.object({
  records: z.array(z.object({
    studentId: z.string().min(1),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  }).strict()).min(1),
}).strict();

export async function PUT(req: NextRequest, context: RouteContext) {
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;

  try {
    const input = bodySchema.parse(await req.json());
    const { courseId, lectureId } = await context.params;
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, facultyId: true } });
    if (!course || course.facultyId !== auth.user.faculty?.id) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }
    const lecture = await prisma.lecture.findUnique({ where: { id: lectureId }, select: { id: true, courseId: true } });
    if (!lecture || lecture.courseId !== courseId) {
      return NextResponse.json({ error: 'Lecture not found.' }, { status: 404 });
    }

    const enrollments = await prisma.enrollment.findMany({ where: { courseId }, select: { studentId: true } });
    const enrolledStudentIds = new Set(enrollments.map((enrollment) => enrollment.studentId));
    if (input.records.some((record) => !enrolledStudentIds.has(record.studentId))) {
      return NextResponse.json({ error: 'Attendance record includes a student not enrolled in this course.' }, { status: 400 });
    }

    let saved = 0;
    let unchanged = 0;
    const changedStudentIds: string[] = [];
    for (const record of input.records) {
      const existing = await prisma.attendance.findUnique({
        where: { studentId_lectureId: { studentId: record.studentId, lectureId } },
        select: { status: true },
      });
      if (existing?.status === record.status) {
        unchanged += 1;
        continue;
      }
      await prisma.attendance.upsert({
        where: { studentId_lectureId: { studentId: record.studentId, lectureId } },
        create: { studentId: record.studentId, lectureId, status: record.status },
        update: { status: record.status },
      });
      saved += 1;
      changedStudentIds.push(record.studentId);
    }

    const twinUpdatesQueued = scheduleTwinSync(changedStudentIds.map((studentId) => ({
      studentId,
      event: 'attendance_marked' as const,
      sourceKey: `attendance:${lectureId}:${studentId}:${input.records.find((record) => record.studentId === studentId)?.status}`,
    })));
    return NextResponse.json({ saved, unchanged, twinUpdatesQueued });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid attendance records.' }, { status: 400 });
    }
    console.error('[FACULTY_ATTENDANCE_SAVE_ERROR]', error);
    return NextResponse.json({ error: 'Unable to save attendance.' }, { status: 500 });
  }
}
