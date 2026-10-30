import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { setAuthCookie } from '@/lib/auth/session';
import { facultyLoginSchema } from '@/lib/validation/schemas';
import { tokenHash } from '@/lib/api-auth';
import { checkRateLimit, resetRateLimit } from '@/lib/auth/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = facultyLoginSchema.parse(body);
    const facultyId = input.facultyId.trim().toUpperCase();
    const rateLimitKey = `faculty:${facultyId}`;
    const rateCheck = checkRateLimit(rateLimitKey);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Too many failed attempts. Try again in ${Math.ceil(rateCheck.retryAfterMs / 60000)} minutes.`,
          code: 'RATE_LIMITED',
          retryAfterMs: rateCheck.retryAfterMs,
        },
        { status: 429 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[LOGIN] Faculty attempt:', { facultyId });
    }

    const faculty = await prisma.faculty.findUnique({
      where: { facultyId },
      include: { user: true },
    });

    // A PENDING account with the CORRECT password learns it awaits approval; anything else gets the
    // same generic answer, so the login form never reveals which faculty IDs exist.
    if (faculty && faculty.user.status === 'PENDING' && (await bcrypt.compare(input.password, faculty.user.passwordHash))) {
      return NextResponse.json(
        { error: 'Your account is awaiting approval by an administrator.', code: 'PENDING_APPROVAL' },
        { status: 403 }
      );
    }

    if (!faculty || faculty.user.status !== 'ACTIVE') {
      await prisma.auditLog.create({
        data: {
          userId: faculty?.user?.id,
          event: 'LOGIN_ATTEMPT',
          metadata: { facultyId, success: false },
          ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        },
      });

      return NextResponse.json(
        { error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    const isValidPassword = await bcrypt.compare(input.password, faculty.user.passwordHash);

    if (process.env.NODE_ENV === 'development') {
      console.log('[LOGIN] Faculty password valid:', isValidPassword);
    }

    await prisma.auditLog.create({
      data: {
        userId: faculty.user.id,
        event: 'LOGIN_ATTEMPT',
        metadata: { facultyId, success: isValidPassword },
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      },
    });

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    resetRateLimit(rateLimitKey);

    const payload = {
      userId: faculty.user.id,
      role: 'FACULTY' as const,
      email: faculty.user.email,
      name: faculty.fullName,
      facultyId: faculty.facultyId,
      department: faculty.department,
    };

    const token = await setAuthCookie(payload);

    await prisma.session.create({
      data: {
        userId: faculty.user.id,
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: faculty.user.id,
        event: 'LOGIN_SUCCESS',
        metadata: { facultyId, role: 'FACULTY' },
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: faculty.user.id,
        role: 'FACULTY',
        name: faculty.fullName,
        facultyId: faculty.facultyId,
        email: faculty.user.email,
      },
      // An account created with someone else's password must set its own first.
      redirectTo: faculty.user.mustChangePassword ? '/change-password' : '/faculty',
      mustChangePassword: faculty.user.mustChangePassword,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Invalid login data', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    console.error('[LOGIN_FACULTY_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
