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
  return { session, user } as const;
}

export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function writeAudit(userId: string | undefined, event: string, metadata?: object) {
  await prisma.auditLog.create({ data: { userId, event, metadata } });
}