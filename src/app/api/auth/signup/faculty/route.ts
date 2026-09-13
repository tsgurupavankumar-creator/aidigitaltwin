import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { facultySignupSchema } from '@/lib/validation/schemas';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = facultySignupSchema.parse(body);

    const normalizedEmail = input.email.toLowerCase().trim();
    const normalizedFacultyId = input.facultyId.toUpperCase().trim();

    const existingEmail = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: 'Email already registered', code: 'EMAIL_EXISTS' },
        { status: 409 }
      );
    }

    const existingFaculty = await prisma.faculty.findUnique({
      where: { facultyId: normalizedFacultyId },
    });

    if (existingFaculty) {
      return NextResponse.json(
        { error: 'Faculty ID already registered', code: 'FACULTY_EXISTS' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: 'FACULTY',
        status: 'PENDING',
        faculty: {
          create: {
            facultyId: normalizedFacultyId,
            fullName: input.fullName.trim(),
            department: input.department || 'Computer Science',
            designation: 'Professor',
          },
        },
      },
      include: { faculty: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        event: 'FACULTY_SIGNUP_PENDING',
        metadata: { facultyId: normalizedFacultyId, role: 'FACULTY' },
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Faculty account created. Awaiting admin approval.',
      user: {
        id: user.id,
        role: 'FACULTY',
        name: user.faculty!.fullName,
        facultyId: user.faculty!.facultyId,
        email: user.email,
        status: 'PENDING',
      },
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

    console.error('[SIGNUP_FACULTY_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}