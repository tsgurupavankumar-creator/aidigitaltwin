import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { setAuthCookie } from '@/lib/auth/session';
import { studentLoginSchema } from '@/lib/validation/schemas';
import { tokenHash } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = studentLoginSchema.parse(body);
    const rollNumber = input.rollNumber.trim().toUpperCase();
    const dobValue = new Date(input.dob);
    const dobMatchKey = Number.isNaN(dobValue.getTime()) ? null : new Date(dobValue).toISOString().split('T')[0];

    if (process.env.NODE_ENV === 'development') {
      console.log('[LOGIN] Attempt:', { rollNumber });
    }

    const student = await prisma.student.findUnique({
      where: { rollNumber },
      include: { user: true, digitalTwin: true },
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[LOGIN] User found:', !!student);
    }

    if (!student || student.user.status !== 'ACTIVE') {
      await prisma.auditLog.create({
        data: {
          userId: student?.user?.id,
          event: 'LOGIN_ATTEMPT',
          metadata: { rollNumber, success: false },
          ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        },
      });

      return NextResponse.json(
        { error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    const storedDob = new Date(student.dob).toISOString().split('T')[0];
    const dobMatch = dobMatchKey === storedDob;

    if (process.env.NODE_ENV === 'development') {
      console.log('[LOGIN] DOB match:', dobMatch, { storedDob, dobMatchKey });
    }

    await prisma.auditLog.create({
      data: {
        userId: student.user.id,
        event: 'LOGIN_ATTEMPT',
        metadata: { rollNumber, success: dobMatch },
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      },
    });

    if (!dobMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    const payload = {
      userId: student.user.id,
      role: 'STUDENT' as const,
      email: student.user.email,
      name: student.fullName,
      rollNumber: student.rollNumber,
      department: student.department,
    };

    const token = await setAuthCookie(payload);

    await prisma.session.create({
      data: {
        userId: student.user.id,
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: student.user.id,
        event: 'LOGIN_SUCCESS',
        metadata: { rollNumber, role: 'STUDENT' },
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: student.user.id,
        role: 'STUDENT',
        name: student.fullName,
        rollNumber: student.rollNumber,
        email: student.user.email,
      },
      redirectTo: '/student',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Invalid login data', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    console.error('[LOGIN_STUDENT_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
