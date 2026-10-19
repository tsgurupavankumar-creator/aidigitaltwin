import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
const schema = z.object({ studentId: z.string().cuid(), type: z.enum(['TUTORING', 'COUNSELING', 'QUIZ', 'MEETING']), notes: z.string().min(1), outcome: z.string().optional() });
export async function GET() {
  const auth = await requireRole('faculty'); if ('error' in auth) return auth.error;
  const data = await prisma.intervention.findMany({ where: { facultyId: auth.user.faculty!.id }, include: { student: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ data });
}
export async function PATCH(req: NextRequest) {
  const auth = await requireRole('faculty'); if ('error' in auth) return auth.error;
  try {
    const input = z.object({ interventionId: z.string().cuid(), action: z.enum(['DISPATCH', 'COMPLETE']) }).parse(await req.json());
    const existing = await prisma.intervention.findFirst({
      where: { id: input.interventionId, facultyId: auth.user.faculty!.id },
    });
    if (!existing) return NextResponse.json({ error: 'Intervention not found.' }, { status: 404 });
    const data = await prisma.intervention.update({
      where: { id: existing.id },
      data: input.action === 'COMPLETE' ? { completedAt: new Date() } : { scheduledAt: new Date() },
    });
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: 'Unable to update intervention.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole('faculty'); if ('error' in auth) return auth.error;
  try {
    const input = schema.parse(await req.json());
    const enrolled = await prisma.enrollment.findFirst({ where: { studentId: input.studentId, course: { facultyId: auth.user.faculty!.id } } });
    if (!enrolled) return NextResponse.json({ error: 'Student is not assigned to your courses.' }, { status: 403 });
    const data = await prisma.intervention.create({ data: { ...input, facultyId: auth.user.faculty!.id } });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0].message }, { status: 400 }); return NextResponse.json({ error: 'Unable to create intervention.' }, { status: 500 }); }
}