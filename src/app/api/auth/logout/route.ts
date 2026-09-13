import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clearAuthCookie, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { tokenHash } from '@/lib/api-auth';

export async function POST() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
  await clearAuthCookie();
  return NextResponse.json({ success: true, message: 'Logged out successfully' });
}
