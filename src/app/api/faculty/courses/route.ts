import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export async function GET() {
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;

  try {
    const facultyId = auth.user.faculty!.id;

    const courses = await prisma.course.findMany({
      where: { facultyId },
      include: {
        enrollments: {
          select: { studentId: true },
        },
        lectures: {
          take: 1,
          orderBy: { date: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    });

    const formatted = courses.map((course) => {
      const schedule = course.lectures[0]
        ? `${course.lectures[0].room} • ${course.lectures[0].time}`
        : null; // only report a schedule that really exists (was a made-up 'MWF 10:00 AM')

      return {
        id: course.id,
        code: course.code,
        name: course.name,
        department: course.department,
        term: `Semester ${course.semester}`,
        schedule,
        studentIds: course.enrollments.map((e) => e.studentId),
      };
    });

    return NextResponse.json({ data: formatted });
  } catch (error) {
    console.error('[FACULTY_COURSES_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch faculty courses' }, { status: 500 });
  }
}

const createCourseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  department: z.string().trim().min(1).max(80),
  semester: z.number().int().min(1).max(12),
  credits: z.number().int().min(1).max(10).default(3),
});

export async function POST(req: NextRequest) {
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;

  try {
    const input = createCourseSchema.parse(await req.json());
    const prefix = input.department.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'COURSE';
    let code = '';
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const exists = await prisma.course.findUnique({ where: { code: candidate }, select: { id: true } });
      if (!exists) { code = candidate; break; }
    }
    if (!code) return NextResponse.json({ error: 'Unable to generate a unique course code' }, { status: 500 });

    const course = await prisma.course.create({
      data: {
        code,
        name: input.name,
        department: input.department,
        semester: input.semester,
        credits: input.credits,
        facultyId: auth.user.faculty!.id,
      },
    });
    return NextResponse.json({ data: { ...course, term: `Semester ${course.semester}`, schedule: null, studentIds: [] } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: 'Unable to create course.' }, { status: 500 });
  }
}
