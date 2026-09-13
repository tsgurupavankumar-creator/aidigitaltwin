import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { setAuthCookie } from '@/lib/auth/session';
import { studentSignupSchema } from '@/lib/validation/schemas';
import { tokenHash } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = studentSignupSchema.parse(body);

    const normalizedEmail = input.email.toLowerCase().trim();
    const normalizedRoll = input.rollNumber.toUpperCase().trim();

    const existingEmail = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: 'Email already registered', code: 'EMAIL_EXISTS' },
        { status: 409 }
      );
    }

    const existingRoll = await prisma.student.findUnique({
      where: { rollNumber: normalizedRoll },
    });

    if (existingRoll) {
      return NextResponse.json(
        { error: 'Roll number already registered', code: 'ROLL_EXISTS' },
        { status: 409 }
      );
    }

    // ✅ FIX: Convert DOB string to Date object for Prisma
    const dobDate = new Date(input.dob);
    if (isNaN(dobDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date of birth', code: 'INVALID_DOB' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: 'STUDENT',
        status: 'ACTIVE',
        student: {
          create: {
            rollNumber: normalizedRoll,
            fullName: input.fullName.trim(),
            dob: dobDate,
            department: 'Computer Science',
            year: 2,
            semester: 4,
            section: 'A',
            digitalTwin: {
              create: {
                academicHealth: 0,
                performanceScore: 0,
                attendanceScore: 0,
                engagementScore: 0,
                knowledgeScore: 0,
                learningVelocity: 0,
                behaviorScore: 0,
                skillsScore: 0,
              },
            },
          },
        },
      },
      include: { student: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        event: 'SIGNUP_SUCCESS',
        metadata: { rollNumber: normalizedRoll, role: 'STUDENT' },
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      },
    });

    const payload = {
      userId: user.id,
      role: 'STUDENT' as const,
      email: user.email,
      name: user.student!.fullName,
      rollNumber: user.student!.rollNumber,
      department: user.student!.department,
    };

    const token = await setAuthCookie(payload);

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        role: 'STUDENT',
        name: user.student!.fullName,
        rollNumber: user.student!.rollNumber,
        email: user.email,
      },
      redirectTo: '/student',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message || 'Invalid signup data',
          code: 'INVALID_INPUT',
        },
        { status: 400 }
      );
    }

    console.error('[SIGNUP_STUDENT_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}