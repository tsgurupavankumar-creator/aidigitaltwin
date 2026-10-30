import { endOfDay, localDay } from '@/lib/twin/deadline';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireOwnCourse } from '@/lib/twin/access';
import { handle, isoDay, cuid } from '@/lib/twin/http';
import { RecordError } from '@/lib/twin/records';

type Ctx = { params: Promise<{ courseId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle('ASSIGNMENTS_GET', async () => {
    const { courseId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const assignments = await prisma.assignment.findMany({
      where: { courseId },
      orderBy: { dueDate: 'desc' },
      select: {
        id: true, title: true, description: true, maxMarks: true, dueDate: true,
        submissions: { select: { status: true } },
        questions: { select: { concept: { select: { id: true, name: true } } } },
      },
    });
    return NextResponse.json({
      assignments: assignments.map((a) => ({
        id: a.id, title: a.title, description: a.description, maxMarks: a.maxMarks,
        dueDate: localDay(a.dueDate),
        graded: a.submissions.filter((s) => s.status === 'GRADED').length,
        submitted: a.submissions.filter((s) => s.status === 'SUBMITTED' || s.status === 'LATE').length,
        concepts: [...new Map(a.questions.map((q) => [q.concept.id, q.concept])).values()],
      })),
    });
  });
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  maxMarks: z.number().positive().max(10000),
  dueDate: isoDay,
  conceptIds: z.array(cuid).max(50).default([]),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  return handle('ASSIGNMENTS_POST', async () => {
    const { courseId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const input = createSchema.parse(await req.json());
    const titleTaken = await prisma.assignment.findFirst({ where: { courseId, title: { equals: input.title, mode: 'insensitive' } }, select: { id: true } });
    if (titleTaken) throw new RecordError('An assignment with this title already exists in this course (titles identify assignments in CSV imports).', 409);
    const concepts = await prisma.concept.findMany({ where: { courseId, id: { in: input.conceptIds } }, select: { id: true, name: true } });
    if (concepts.length !== new Set(input.conceptIds).size) throw new RecordError('Some concepts do not belong to this course.');
    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.assignment.create({
        data: { courseId, title: input.title, description: input.description, maxMarks: input.maxMarks, dueDate: endOfDay(input.dueDate) },
        select: { id: true, title: true, maxMarks: true, dueDate: true },
      });
      // The schema links assignments to concepts only through Question rows,
      // so each assessed concept gets one instructor-graded question. Grades
      // then update mastery for exactly these concepts.
      for (const c of concepts) {
        await tx.question.create({
          data: { assignmentId: created.id, conceptId: c.id, type: 'SHORT_ANSWER', difficulty: 3, options: { prompt: `Assessed concept: ${c.name}` }, correctAnswer: 'Graded by instructor' },
        });
      }
      return created;
    });
    return NextResponse.json({ assignment: { ...assignment, dueDate: assignment.dueDate.toISOString().slice(0, 10) } }, { status: 201 });
  });
}
