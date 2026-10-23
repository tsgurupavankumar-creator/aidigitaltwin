import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireOwnCourse } from '@/lib/twin/access';
import { handle, isoDay } from '@/lib/twin/http';

type Ctx = { params: Promise<{ courseId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle('LECTURES_GET', async () => {
    const { courseId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const [lectures, enrolled] = await Promise.all([
      prisma.lecture.findMany({
        where: { courseId },
        orderBy: [{ date: 'desc' }, { time: 'desc' }],
        select: { id: true, date: true, time: true, room: true, attendance: { select: { status: true } } },
      }),
      prisma.enrollment.count({ where: { courseId } }),
    ]);
    return NextResponse.json({
      enrolled,
      lectures: lectures.map((l) => ({
        id: l.id,
        date: l.date.toISOString().slice(0, 10),
        time: l.time,
        room: l.room,
        marked: l.attendance.length,
        attended: l.attendance.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length,
      })),
    });
  });
}

const createSchema = z.object({
  date: isoDay,
  time: z.string().trim().max(20).default(''),
  room: z.string().trim().max(40).default(''),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  return handle('LECTURES_POST', async () => {
    const { courseId } = await ctx.params;
    const access = await requireOwnCourse(courseId);
    if (!access.ok) return access.error;
    const input = createSchema.parse(await req.json());
    const lecture = await prisma.lecture.create({
      data: { courseId, date: new Date(`${input.date}T00:00:00.000Z`), time: input.time, room: input.room },
      select: { id: true, date: true, time: true, room: true },
    });
    return NextResponse.json({ lecture: { ...lecture, date: lecture.date.toISOString().slice(0, 10) } }, { status: 201 });
  });
}
