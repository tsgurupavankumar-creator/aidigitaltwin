import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export async function requireRole(role: 'student' | 'faculty') {
  const session = await getAuthSession();
  if (!session?.id) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  if ((session.role || '').toLowerCase() !== role.toLowerCase()) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
  const user = await prisma.user.findUnique({ where: { id: session.id }, include: { student: true, faculty: true } });
  if (!user || user.status !== 'ACTIVE') return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  // Accounts created with a password someone else knows (e.g. faculty-added students) can do nothing
  // until they set their own: enforced here for every role-protected API, not only in the UI.
  if (user.mustChangePassword) {
    return { error: NextResponse.json({ error: 'Please set a new password first.', code: 'PASSWORD_CHANGE_REQUIRED', redirectTo: '/change-password' }, { status: 403 }) } as const;
  }
  return { session, user } as const;
}

export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function writeAudit(userId: string | undefined, event: string, metadata?: object) {
  await prisma.auditLog.create({ data: { userId, event, metadata } });
}

/**
 * For routes that check the session directly instead of using requireRole: refuses the request
 * while the account must still set its own password (same 403 as requireRole).
 */
export async function blockIfPasswordChangeRequired(userId: string): Promise<NextResponse | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { mustChangePassword: true } });
  if (!user?.mustChangePassword) return null;
  return NextResponse.json({ error: 'Please set a new password first.', code: 'PASSWORD_CHANGE_REQUIRED', redirectTo: '/change-password' }, { status: 403 });
}

