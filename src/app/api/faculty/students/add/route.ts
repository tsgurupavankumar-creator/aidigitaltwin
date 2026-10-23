import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/api-auth';
import { hashPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';
import { facultyAddStudentSchema } from '@/lib/validation/schemas';

const requestSchema = facultyAddStudentSchema.strict();

export async function POST(req: NextRequest) {
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;

  try {
    const input = requestSchema.parse(await req.json());
    const facultyId = auth.user.faculty?.id;
    if (!facultyId) return NextResponse.json({ error: 'Faculty profile not found.' }, { status: 403 });

    const temporaryPassword = randomBytes(18).toString('base64url');
    const passwordHash = await hashPassword(temporaryPassword);

    const student = await prisma.$transaction(async (tx) => {
      const course = await tx.course.findFirst({
        where: { id: input.courseId, facultyId },
        select: { id: true },
      });
      if (!course) throw new Error('COURSE_NOT_ASSIGNED');

      const user = await tx.user.create({
        data: { email: input.email, passwordHash, role: 'STUDENT' },
        select: { id: true },
      });
      const createdStudent = await tx.student.create({
        data: {
          userId: user.id,
          rollNumber: input.rollNumber,
          fullName: input.fullName,
          dob: new Date(`${input.dob}T00:00:00.000Z`),
          department: input.department,
          year: input.year,
          semester: input.semester,
          section: input.section,
        },
        select: { id: true, fullName: true, rollNumber: true },
      });
      await tx.digitalTwin.create({
        data: {
          studentId: createdStudent.id,
          academicHealth: 0,
          performanceScore: 0,
          attendanceScore: 0,
          engagementScore: 0,
          knowledgeScore: 0,
          learningVelocity: 0,
          behaviorScore: 0,
          skillsScore: 0,
        },
      });
      await tx.enrollment.create({
        data: { studentId: createdStudent.id, courseId: course.id },
      });

      return createdStudent;
    });

    return NextResponse.json({ data: { student, temporaryPassword } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid request.' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'COURSE_NOT_ASSIGNED') {
      return NextResponse.json({ error: 'Course not found or not assigned to you.' }, { status: 403 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'An account with this email or roll number already exists.' }, { status: 400 });
    }

    console.error('[FACULTY_ADD_STUDENT_ERROR]', error);
    return NextResponse.json({ error: 'Unable to add student.' }, { status: 500 });
  }
}
