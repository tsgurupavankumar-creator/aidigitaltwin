import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { setAuthCookie } from '@/lib/auth/session';
import { tokenHash, writeAudit } from '@/lib/api-auth';

const schema = z.object({ identifier: z.string().min(1), password: z.string().min(1), role: z.enum(['student', 'faculty', 'STUDENT', 'FACULTY']) });

export async function POST(req: NextRequest) {
  try {
    const input = schema.parse(await req.json());
    const isStudent = input.role.toLowerCase() === 'student';
    if (isStudent) {
      const user = await prisma.user.findFirst({ where: { role: 'STUDENT', student: { rollNumber: input.identifier.toUpperCase() } }, include: { student: { include: { digitalTwin: true } } } });
      if (!user || user.status !== 'ACTIVE' || !(await verifyPassword(input.password, user.passwordHash)) || !user.student) return NextResponse.json({ error: 'Invalid Roll Number or Date of Birth' }, { status: 401 });
      const payload = { userId: user.id, role: 'STUDENT' as const, name: user.student.fullName, email: user.email, rollNumber: user.student.rollNumber, department: user.student.department };
      const token = await setAuthCookie(payload);
      await prisma.session.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 1800000) } });
      await writeAudit(user.id, 'LOGIN_SUCCESS');
      return NextResponse.json({ success: true, user: payload, twin: user.student.digitalTwin });
    }
    const user = await prisma.user.findFirst({ where: { role: 'FACULTY', faculty: { facultyId: input.identifier.toUpperCase() } }, include: { faculty: true } });
    if (!user || user.status !== 'ACTIVE' || !(await verifyPassword(input.password, user.passwordHash)) || !user.faculty) return NextResponse.json({ error: 'Invalid Faculty ID or Password' }, { status: 401 });
    const payload = { userId: user.id, role: 'FACULTY' as const, name: user.faculty.fullName, email: user.email, facultyId: user.faculty.facultyId, department: user.faculty.department };
    const token = await setAuthCookie(payload);
    await prisma.session.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 1800000) } });
    await writeAudit(user.id, 'LOGIN_SUCCESS');
    return NextResponse.json({ success: true, user: payload });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    console.error('[LOGIN_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error during login.' }, { status: 500 });
  }
}