import { randomInt } from 'crypto';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { facultyAddStudentSchema } from '@/lib/validation/schemas';
import { z } from 'zod';

function generateTemporaryPassword() {
  const characterGroups = [
    'abcdefghijklmnopqrstuvwxyz',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    '0123456789',
    '!@#$%^&*()-_=+',
  ];
  const allCharacters = characterGroups.join('');
  const characters = characterGroups.map((group) => group[randomInt(group.length)]);

  for (let i = 0; i < 20; i += 1) {
    characters.push(allCharacters[randomInt(allCharacters.length)]);
  }

  for (let i = characters.length - 1; i > 0; i -= 1) {
    const swapIndex = randomInt(i + 1);
    [characters[i], characters[swapIndex]] = [characters[swapIndex], characters[i]];
  }

  return characters.join('');
}

export async function POST(req: NextRequest) {
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;

  try {
    const input = facultyAddStudentSchema.parse(await req.json());
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const student = await prisma.$transaction(async (tx) => {
      const course = await tx.course.findFirst({
        where: { id: input.courseId, facultyId: auth.user.faculty!.id },
        select: { id: true },
      });
      if (!course) return null;

      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          role: 'STUDENT',
          status: 'ACTIVE',
        },
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
        select: { id: true, rollNumber: true, fullName: true, userId: true },
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

    if (!student) {
      return NextResponse.json({ error: 'Course not found in your assigned courses' }, { status: 404 });
    }

    return NextResponse.json({ data: { student, temporaryPassword } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid student details' }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'A student with this email or roll number already exists' }, { status: 400 });
    }

    console.error('[FACULTY_ADD_STUDENT_ERROR]', error);
    return NextResponse.json({ error: 'Unable to add student' }, { status: 500 });
  }
}
