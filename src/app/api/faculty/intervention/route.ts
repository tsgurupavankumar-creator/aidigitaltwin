import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
const schema = z.object({ studentId: z.string().cuid(), type: z.enum(['TUTORING', 'COUNSELING', 'QUIZ', 'MEETING']), notes: z.string().min(1), outcome: z.string().optional() });
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