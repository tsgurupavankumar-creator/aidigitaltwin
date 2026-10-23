import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIp } from '@/lib/auth/client-ip';
import { hashPassword } from '@/lib/auth/password';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { prisma } from '@/lib/prisma';
import { facultySignupSchema } from '@/lib/validation/schemas';

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(`faculty-signup:ip:${clientIp(req)}`, { max: 20 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many signup attempts. Please try again later.', code: 'RATE_LIMITED' },
      { status: 429 }
    );
  }

  try {
    const input = facultySignupSchema.parse(await req.json());
    const user = await prisma.user.create({
      data: {
        email: input.email.trim().toLowerCase(),
        passwordHash: await hashPassword(input.password),
        role: 'FACULTY',
        status: 'PENDING',
        faculty: {
          create: {
            facultyId: input.facultyId.trim().toUpperCase(),
            fullName: input.fullName.trim(),
            department: input.department.trim(),
            designation: 'Faculty',
          },
        },
      },
      select: { id: true },
    });
    return NextResponse.json({ success: true, userId: user.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid request.' }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'An account with this email or faculty ID already exists.' }, { status: 409 });
    }
    console.error('[FACULTY_SIGNUP_ERROR]', error);
    return NextResponse.json({ error: 'Unable to create faculty account.' }, { status: 500 });
  }
}
