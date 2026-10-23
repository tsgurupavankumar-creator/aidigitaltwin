import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIp } from '@/lib/auth/client-ip';
import { createAuthenticatedSession } from '@/lib/auth/session';
import { verifyPassword } from '@/lib/auth/password';
import { checkRateLimit, resetRateLimit } from '@/lib/auth/rate-limit';
import { prisma } from '@/lib/prisma';
import { facultyLoginSchema } from '@/lib/validation/schemas';

const requestSchema = facultyLoginSchema.extend({ rememberMe: z.boolean().optional() }).strict();

export async function POST(req: NextRequest) {
  try {
    const input = requestSchema.parse(await req.json());
    const facultyId = input.facultyId.trim().toUpperCase();
    const rateKey = `faculty-login:ip:${clientIp(req)}`;
    const rate = checkRateLimit(rateKey);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts. Please try again later.', code: 'RATE_LIMITED' },
        { status: 429 }
      );
    }

    const faculty = await prisma.faculty.findUnique({
      where: { facultyId },
      include: { user: true },
    });
    if (
      !faculty ||
      faculty.user.role !== 'FACULTY' ||
      faculty.user.status !== 'ACTIVE' ||
      !(await verifyPassword(input.password, faculty.user.passwordHash))
    ) {
      return NextResponse.json({ error: 'Invalid faculty ID or password.' }, { status: 401 });
    }

    await createAuthenticatedSession({
      userId: faculty.user.id,
      role: 'FACULTY',
      email: faculty.user.email,
    }, clientIp(req));
    resetRateLimit(rateKey);

    return NextResponse.json({
      success: true,
      redirectTo: '/faculty',
      user: {
        id: faculty.user.id,
        facultyId: faculty.id,
        name: faculty.fullName,
        email: faculty.user.email,
        role: 'FACULTY',
        department: faculty.department,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid request.' }, { status: 400 });
    }
    console.error('[FACULTY_LOGIN_ERROR]', error);
    return NextResponse.json({ error: 'Unable to sign in right now.' }, { status: 500 });
  }
}
