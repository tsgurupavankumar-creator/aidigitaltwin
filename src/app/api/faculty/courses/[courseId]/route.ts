import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ courseId: string }>;
}

const enrollmentSchema = z.object({ studentName: z.string().trim().min(1).max(120) }).strict();

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;
  const { courseId } = await context.params;
  const course = await prisma.course.findFirst({
    where: { id: courseId, facultyId: auth.user.faculty!.id },
    include: {
      lectures: { orderBy: { date: 'asc' }, take: 1, select: { date: true, time: true, room: true } },
      enrollments: {
        include: {
          student: {
            include: {
              digitalTwin: true,
              riskAssessments: { orderBy: { createdAt: 'desc' }, take: 1, select: { riskLevel: true, riskScore: true } },
              attendance: { where: { lecture: { courseId } }, select: { status: true } },
            },
          },
        },
      },
      _count: { select: { lectures: true } },
      concepts: { select: { id: true, name: true } },
    },
  });
  if (!course) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });

  const students = course.enrollments.map(({ student }) => {
    const risk = student.riskAssessments[0];
    return {
      id: student.id,
      rollNumber: student.rollNumber,
      name: student.fullName,
      academicHealth: student.digitalTwin?.academicHealth ?? null,
      attendance: student.digitalTwin?.attendanceScore ?? null,
      riskLevel: risk?.riskLevel ?? null,
      riskScore: risk?.riskScore ?? null,
    };
  });
  const healthValues = students.map((student) => student.academicHealth).filter((value): value is number => value !== null);
  const attendanceValues = students.map((student) => student.attendance).filter((value): value is number => value !== null);
  const schedule = course.lectures[0]
    ? `${course.lectures[0].room} • ${course.lectures[0].time}`
    : null;

  return NextResponse.json({
    data: {
      id: course.id,
      code: course.code,
      name: course.name,
      department: course.department,
      semester: course.semester,
      schedule,
      students,
      avgHealth: healthValues.length ? healthValues.reduce((sum, value) => sum + value, 0) / healthValues.length : null,
      avgAttendance: attendanceValues.length ? attendanceValues.reduce((sum, value) => sum + value, 0) / attendanceValues.length : null,
      concepts: course.concepts ?? [],
      lectureCount: course._count?.lectures ?? course.lectures.length,
    },
  });
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;
  try {
    const input = enrollmentSchema.parse(await req.json());
    const { courseId } = await context.params;
    const course = await prisma.course.findFirst({
      where: { id: courseId, facultyId: auth.user.faculty!.id },
      select: { id: true },
    });
    if (!course) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });

    const rollNumber = input.studentName.trim().toUpperCase();
    const studentByRoll = await prisma.student.findFirst({
      where: { rollNumber },
      select: { id: true, fullName: true, rollNumber: true },
    });
    let student = studentByRoll;
    if (!student) {
      const matches = await prisma.student.findMany({
        where: { fullName: { equals: input.studentName, mode: 'insensitive' } },
        select: { id: true, fullName: true, rollNumber: true },
      });
      if (matches.length > 1) {
        return NextResponse.json({ error: 'More than one student has that name.', code: 'AMBIGUOUS_STUDENT' }, { status: 409 });
      }
      student = matches[0] ?? null;
    }
    if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

    const existing = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: student.id, courseId } },
    });
    if (existing) return NextResponse.json({ data: { alreadyEnrolled: true } });

    const enrollment = await prisma.enrollment.create({
      data: { studentId: student.id, courseId },
    });
    return NextResponse.json({ data: enrollment }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid request.' }, { status: 400 });
    console.error('[FACULTY_COURSE_ENROLL_ERROR]', error);
    return NextResponse.json({ error: 'Unable to enroll student.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;
  const { courseId } = await context.params;
  const course = await prisma.course.findFirst({
    where: { id: courseId, facultyId: auth.user.faculty!.id },
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });

  const [enrollments, lectures, topics, concepts, assignments, quizzes, insights] = await Promise.all([
    prisma.enrollment.count({ where: { courseId } }),
    prisma.lecture.count({ where: { courseId } }),
    prisma.topic.count({ where: { courseId } }),
    prisma.concept.count({ where: { courseId } }),
    prisma.assignment.count({ where: { courseId } }),
    prisma.quiz.count({ where: { courseId } }),
    prisma.classInsight.count({ where: { courseId } }),
  ]);
  const total = enrollments + lectures + topics + concepts + assignments + quizzes + insights;
  if (total) {
    const details = [
      enrollments && `${enrollments} enrollments`,
      lectures && `${lectures} lectures`,
      topics && `${topics} topics`,
      concepts && `${concepts} concepts`,
      assignments && `${assignments} assignments`,
      quizzes && `${quizzes} quizzes`,
      insights && `${insights} insights`,
    ].filter(Boolean).join(', ');
    return NextResponse.json(
      { error: `Course contains ${details} and cannot be deleted.`, code: 'COURSE_HAS_DATA' },
      { status: 409 }
    );
  }

  await prisma.course.delete({ where: { id: courseId } });
  return NextResponse.json({ success: true });
}
