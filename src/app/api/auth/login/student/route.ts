import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIp } from '@/lib/auth/client-ip';
import { createAuthenticatedSession } from '@/lib/auth/session';
import { verifyPassword } from '@/lib/auth/password';
import { checkRateLimit, resetRateLimit } from '@/lib/auth/rate-limit';
import { prisma } from '@/lib/prisma';
import { studentLoginSchema } from '@/lib/validation/schemas';

const requestSchema = studentLoginSchema.strict();

export async function POST(req: NextRequest) {
  try {
    const input = requestSchema.parse(await req.json());
    const rollNumber = input.rollNumber.trim().toUpperCase();
    const rateKey = `student-login:ip:${clientIp(req)}`;
    const rate = checkRateLimit(rateKey);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts. Please try again later.', code: 'RATE_LIMITED' },
        { status: 429 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { rollNumber },
      include: { user: true },
    });
    const dateOfBirth = student?.dob.toISOString().slice(0, 10);
    const validCredentials = Boolean(
      student &&
      student.user.role === 'STUDENT' &&
      student.user.status === 'ACTIVE' &&
      dateOfBirth === input.dob &&
      await verifyPassword(input.password, student.user.passwordHash)
    );
    if (!validCredentials || !student) {
      return NextResponse.json({ error: 'Invalid roll number, date of birth, or password.' }, { status: 401 });
    }

    await createAuthenticatedSession({
      userId: student.user.id,
      role: 'STUDENT',
      email: student.user.email,
    }, clientIp(req));
    resetRateLimit(rateKey);

    return NextResponse.json({
      success: true,
      redirectTo: '/student',
      user: {
        id: student.user.id,
        studentId: student.id,
        name: student.fullName,
        email: student.user.email,
        role: 'STUDENT',
        rollNumber: student.rollNumber,
        department: student.department,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid request.' }, { status: 400 });
    }
    console.error('[STUDENT_LOGIN_ERROR]', error);
    return NextResponse.json({ error: 'Unable to sign in right now.' }, { status: 500 });
  }
}
