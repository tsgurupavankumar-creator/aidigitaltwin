import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
export async function GET() {
  const auth = await requireRole('student'); if ('error' in auth) return auth.error;
  const twin = await prisma.digitalTwin.findUnique({ where: { studentId: auth.user.student!.id } });
  return NextResponse.json({ data: twin });
}