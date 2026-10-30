import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/twin/access';
import { historyResponse } from '@/lib/twin/twin-api';

/** The signed-in student's own twin over time. */
export async function GET() {
  const auth = await requireUser('student');
  if (!auth.ok) return auth.error;
  const studentId = auth.user.student?.id;
  if (!studentId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return historyResponse(studentId);
}
