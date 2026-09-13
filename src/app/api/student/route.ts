import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
  }

  if ((session.role || '').toLowerCase() !== 'student') {
    console.warn(`[SECURITY AUDIT] Forbidden attempt by non-student (${session.role}) to student API`);
    return NextResponse.json({ error: 'Forbidden: Access denied to student API' }, { status: 403 });
  }

  return NextResponse.json({
    status: 'success',
    data: {
      message: 'Student telemetry and digital twin state retrieved',
      studentId: session.rollNumber || session.id,
      timestamp: new Date().toISOString(),
    },
  });
}
