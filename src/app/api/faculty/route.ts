import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
  }

  if ((session.role || '').toLowerCase() !== 'faculty') {
    console.warn(`[SECURITY AUDIT] Forbidden attempt by non-faculty (${session.role}) to faculty API`);
    return NextResponse.json({ error: 'Forbidden: Access denied to faculty API' }, { status: 403 });
  }

  return NextResponse.json({
    status: 'success',
    data: {
      message: 'Faculty class intelligence and cohort telemetry retrieved',
      facultyId: session.facultyId || session.id,
      timestamp: new Date().toISOString(),
    },
  });
}
