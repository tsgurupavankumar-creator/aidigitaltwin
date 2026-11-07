import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/twin/access';
import { whatIfResponse } from '@/lib/twin/twin-api';

/** A student simulates a scenario for themselves (nothing is saved). */
export async function POST(req: NextRequest) {
  const auth = await requireUser('student');
  if (!auth.ok) return auth.error;
  const studentId = auth.user.student?.id;
  if (!studentId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return whatIfResponse(`student:${studentId}`, studentId, await req.json().catch(() => null));
}
