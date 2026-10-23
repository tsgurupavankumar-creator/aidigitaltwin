import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIp } from '@/lib/auth/client-ip';
import { createAuthenticatedSession } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { checkRateLimit, resetRateLimit } from '@/lib/auth/rate-limit';
import { isRosterEntryMatch, loadStudentRoster } from '@/lib/auth/student-roster';
import { prisma } from '@/lib/prisma';
import { studentSignupSchema } from '@/lib/validation/schemas';

const requestSchema = studentSignupSchema;

export async function POST(req: NextRequest) {
  const rateKey = `student-signup:ip:${clientIp(req)}`;
  const rate = checkRateLimit(rateKey, { max: 20 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many signup attempts. Please try again later.', code: 'RATE_LIMITED' },
      { status: 429 }
    );
  }

  try {
    const input = requestSchema.parse(await req.json());
    let roster;
    try {
      roster = loadStudentRoster();
    } catch (error) {
      console.error('[STUDENT_SIGNUP_ROSTER_ERROR]', error);
      return NextResponse.json(
        { error: 'Student registration is temporarily unavailable.', code: 'ROSTER_UNAVAILABLE' },
        { status: 503 }
      );
    }

    if (!isRosterEntryMatch(roster, input.rollNumber, input.dob)) {
      return NextResponse.json(
        { error: 'Your roll number and date of birth do not match the student roster.', code: 'ROSTER_MISMATCH' },
        { status: 403 }
      );
    }

    const email = input.email.trim().toLowerCase();
    const rollNumber = input.rollNumber.trim().toUpperCase();
    const passwordHash = await hashPassword(input.password);
    const student = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, role: 'STUDENT' },
        select: { id: true },
      });
      const createdStudent = await tx.student.create({
        data: {
          userId: user.id,
          rollNumber,
          fullName: input.fullName.trim(),
          dob: new Date(`${input.dob}T00:00:00.000Z`),
          department: 'Unassigned',
          year: 1,
          semester: 1,
          section: 'Unassigned',
        },
        select: { id: true, fullName: true, rollNumber: true, department: true },
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
      return { ...createdStudent, userId: user.id };
    });

    await createAuthenticatedSession({
      userId: student.userId,
      role: 'STUDENT',
      email,
    }, clientIp(req));
    resetRateLimit(rateKey);

    return NextResponse.json({
      success: true,
      redirectTo: '/student',
      user: {
        id: student.userId,
        studentId: student.id,
        name: student.fullName,
        email,
        role: 'STUDENT',
        rollNumber: student.rollNumber,
        department: student.department,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Invalid request.', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'An account with this email or roll number already exists.', code: 'ACCOUNT_EXISTS' },
        { status: 409 }
      );
    }

    console.error('[STUDENT_SIGNUP_ERROR]', error);
    return NextResponse.json({ error: 'Unable to create student account.' }, { status: 500 });
  }
}
