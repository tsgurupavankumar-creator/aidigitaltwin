import { updateCourse } from '@/lib/twin/manage';
import { RecordError } from '@/lib/twin/records';
import { requireOwnCourse } from '@/lib/twin/access';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { isAtRiskLevel } from '@/lib/risk/at-risk';

export async function GET(req: NextRequest, props: { params: Promise<{ courseId: string }> }) {
  const params = await props.params;
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;

  try {
    const { courseId } = params;

    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        facultyId: auth.user.faculty!.id,
      },
      include: {
        enrollments: {
          include: {
            student: {
              include: {
                digitalTwin: true,
                riskAssessments: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
                attendance: {
                  where: { lecture: { courseId } },
                  select: { status: true },
                },
              },
            },
          },
        },
        lectures: {
          take: 1,
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const students = course.enrollments.map((e) => {
      const st = e.student;
      const latestRisk = st.riskAssessments[0];
      const totalAtt = st.attendance.length;
      const presentAtt = st.attendance.filter(
        (a) => a.status === 'PRESENT' || a.status === 'LATE'
      ).length;
      const attPct = totalAtt ? Math.round((presentAtt / totalAtt) * 100) : st.digitalTwin ? Math.round(st.digitalTwin.attendanceScore) : null;

      return {
        id: st.id,
        rollNumber: st.rollNumber,
        name: st.fullName,
        // null means "no data yet". These used to default to 75 / 85 / LOW / 25,
        // which displayed invented numbers for students nobody had measured.
        academicHealth: st.digitalTwin ? Math.round(st.digitalTwin.academicHealth) : null,
        attendance: attPct,
        riskLevel: latestRisk?.riskLevel ?? null,
        riskScore: latestRisk ? Math.round(latestRisk.riskScore) : null,
      };
    });

    const atRiskCount = students.filter((s) => isAtRiskLevel(s.riskLevel)).length;

    // Average only over students who actually have data; null if nobody does.
    const average = (values: Array<number | null>): number | null => {
      const known = values.filter((v): v is number => v !== null);
      return known.length ? Math.round(known.reduce((sum, v) => sum + v, 0) / known.length) : null;
    };
    const avgHealth = average(students.map((s) => s.academicHealth));
    const avgAttendance = average(students.map((s) => s.attendance));

    const schedule = course.lectures[0]
      ? `${course.lectures[0].room} • ${course.lectures[0].time}`
      : null; // only report a schedule that really exists (was a made-up 'MWF 10:00 AM')

    return NextResponse.json({
      data: {
        id: course.id,
        code: course.code,
        name: course.name,
        department: course.department,
        term: `Semester ${course.semester}`,
        schedule,
        students,
        atRiskCount,
        avgHealth,
        avgAttendance,
      },
    });
  } catch (error) {
    console.error('[FACULTY_COURSE_DETAIL_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch course details' }, { status: 500 });
  }
}

const enrollmentSchema = z.object({
  studentName: z.string().trim().min(1).max(120),
});

export async function POST(req: NextRequest, props: { params: Promise<{ courseId: string }> }) {
  const params = await props.params;
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;

  try {
    const input = enrollmentSchema.parse(await req.json());
    const course = await prisma.course.findFirst({ where: { id: params.courseId, facultyId: auth.user.faculty!.id } });
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    // Roll numbers are unique, so an exact roll-number match is unambiguous and is
    // tried first. Full names are NOT unique, and this used to take whichever
    // matching row the database returned first, so it could silently enroll the
    // wrong person. If several students share the name, refuse and ask for the
    // roll number instead of guessing.
    const select = { id: true, fullName: true, rollNumber: true } as const;
    let student = await prisma.student.findFirst({
      where: { rollNumber: { equals: input.studentName, mode: 'insensitive' } },
      select,
    });
    if (!student) {
      const nameMatches = await prisma.student.findMany({
        where: { fullName: { equals: input.studentName, mode: 'insensitive' } },
        select,
        take: 2,
      });
      if (nameMatches.length > 1) {
        return NextResponse.json(
          { error: 'More than one student has that name. Enter the roll number instead.', code: 'AMBIGUOUS_STUDENT' },
          { status: 409 }
        );
      }
      student = nameMatches[0] ?? null;
    }
    if (!student) return NextResponse.json({ error: 'Student not found. Use the registered full name or roll number.' }, { status: 404 });

    const existing = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
    });
    if (existing) return NextResponse.json({ data: { ...student, alreadyEnrolled: true } });

    await prisma.enrollment.create({ data: { studentId: student.id, courseId: course.id } });
    return NextResponse.json({ data: { ...student, alreadyEnrolled: false } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: 'Unable to enroll student.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ courseId: string }> }) {
  const params = await props.params;
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;
  const course = await prisma.course.findFirst({ where: { id: params.courseId, facultyId: auth.user.faculty!.id }, select: { id: true } });
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  // Deleting a course cascades (onDelete: Cascade in schema.prisma) into its
  // enrollments, lectures and attendance, assignments and submissions (grades),
  // quizzes and attempts, concepts, concept mastery, knowledge-graph edges and
  // study tasks. That is every student's academic history, erased by one request
  // with no undo. So only a course that holds NONE of that can be deleted here.
  const where = { courseId: course.id };
  const [enrollments, lectures, topics, concepts, assignments, quizzes, insights] = await Promise.all([
    prisma.enrollment.count({ where }),
    prisma.lecture.count({ where }),
    prisma.topic.count({ where }),
    prisma.concept.count({ where }),
    prisma.assignment.count({ where }),
    prisma.quiz.count({ where }),
    prisma.classInsight.count({ where }),
  ]);
  const holds = Object.entries({ enrollments, lectures, topics, concepts, assignments, quizzes, 'class insights': insights })
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${count} ${name}`);
  if (holds.length > 0) {
    return NextResponse.json(
      {
        error: `This course can't be deleted because it still holds ${holds.join(', ')}. Deleting it would permanently erase attendance, grades, quiz results and concept mastery for every student in it.`,
        code: 'COURSE_HAS_DATA',
      },
      { status: 409 }
    );
  }

  await prisma.course.delete({ where: { id: course.id } });
  return NextResponse.json({ success: true });
}

const courseEdit = z.object({
  code: z.string().trim().min(2).max(20).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  credits: z.number().int().min(0).max(20).optional(),
  semester: z.number().int().min(1).max(12).optional(),
  department: z.string().trim().min(1).max(120).optional(),
});

/** Edit the course's details. */
export async function PATCH(req: NextRequest, props: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await props.params;
  const access = await requireOwnCourse(courseId);
  if (!access.ok) return access.error;
  const parsed = courseEdit.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid course details' }, { status: 400 });
  try {
    await updateCourse(courseId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RecordError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[COURSE_PATCH_ERROR]', error);
    return NextResponse.json({ error: 'Failed to update course' }, { status: 500 });
  }
}
