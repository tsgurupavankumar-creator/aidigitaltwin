import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { enrolledStudents, requireOwnCourse } from '@/lib/twin/access';
import { handle, cuid } from '@/lib/twin/http';
import { RecordError, saveGrades } from '@/lib/twin/records';
import { scheduleTwinSync } from '@/lib/twin/sync';

type Ctx = { params: Promise<{ courseId: string; assignmentId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle('GRADES_GET', async () => {
    const { courseId, assignmentId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const assignment = await prisma.assignment.findFirst({
      where: { id: assignmentId, courseId },
      select: { id: true, title: true, maxMarks: true, dueDate: true, submissions: { select: { studentId: true, status: true, marksObtained: true, submittedAt: true } } },
    });
    if (!assignment) throw new RecordError('Assignment not found', 404);
    const byStudent = new Map(assignment.submissions.map((s) => [s.studentId, s]));
    const students = await enrolledStudents(courseId);
    return NextResponse.json({
      assignment: { id: assignment.id, title: assignment.title, maxMarks: assignment.maxMarks, dueDate: assignment.dueDate.toISOString().slice(0, 10) },
      students: students.map((s) => {
        const sub = byStudent.get(s.id);
        return { ...s, status: sub?.status ?? null, marksObtained: sub?.marksObtained ?? null, submittedAt: sub?.submittedAt ?? null };
      }),
    });
  });
}

const bodySchema = z.object({
  grades: z.array(z.object({ studentId: cuid, marksObtained: z.number() })).min(1).max(1000),
});

export async function PUT(req: NextRequest, ctx: Ctx) {
  return handle('GRADES_PUT', async () => {
    const { courseId, assignmentId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const { grades } = bodySchema.parse(await req.json());
    const result = await prisma.$transaction((tx) => saveGrades(tx, courseId, assignmentId, grades));
    const twinUpdatesQueued = scheduleTwinSync(result.tasks);
    return NextResponse.json({ saved: result.saved, unchanged: result.unchanged, twinUpdatesQueued });
  });
}
