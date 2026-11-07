import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { enrolledStudents, requireOwnCourse } from '@/lib/twin/access';
import { handle, cuid } from '@/lib/twin/http';
import { RecordError, saveAttendance } from '@/lib/twin/records';
import { scheduleTwinSync } from '@/lib/twin/sync';

type Ctx = { params: Promise<{ courseId: string; lectureId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle('ATTENDANCE_GET', async () => {
    const { courseId, lectureId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const lecture = await prisma.lecture.findFirst({
      where: { id: lectureId, courseId },
      select: { id: true, date: true, time: true, room: true, attendance: { select: { studentId: true, status: true } } },
    });
    if (!lecture) throw new RecordError('Lecture not found', 404);
    const status = new Map(lecture.attendance.map((a) => [a.studentId, a.status]));
    const students = await enrolledStudents(courseId);
    return NextResponse.json({
      lecture: { id: lecture.id, date: lecture.date.toISOString().slice(0, 10), time: lecture.time, room: lecture.room },
      students: students.map((s) => ({ ...s, status: status.get(s.id) ?? null })),
    });
  });
}

const bodySchema = z.object({
  records: z.array(z.object({ studentId: cuid, status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']) })).min(1).max(1000),
});

export async function PUT(req: NextRequest, ctx: Ctx) {
  return handle('ATTENDANCE_PUT', async () => {
    const { courseId, lectureId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const { records } = bodySchema.parse(await req.json());
    const result = await prisma.$transaction((tx) => saveAttendance(tx, courseId, lectureId, records));
    const twinUpdatesQueued = scheduleTwinSync(result.tasks);
    return NextResponse.json({ saved: result.saved, unchanged: result.unchanged, twinUpdatesQueued });
  });
}
