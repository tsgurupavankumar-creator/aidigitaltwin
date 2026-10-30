import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth/session';
import { hashPassword, validatePasswordStrength, verifyPassword } from '@/lib/auth/password';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';
import { tokenHash, writeAudit } from '@/lib/api-auth';

const body = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(1).max(200) });

/** Change your own password while signed in. Also clears "must change password" and signs out
 *  every OTHER session (so anyone who knew the old or temporary password is cut off). */
export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = checkRateLimit(`change-password:${session.id}`, { max: 5, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) return NextResponse.json({ error: 'Too many attempts; try again in a few minutes.' }, { status: 429 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter your current and new password.' }, { status: 400 });
  const { currentPassword, newPassword } = parsed.data;
  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) return NextResponse.json({ error: `New password needs: ${strength.errors.join(', ')}.` }, { status: 400 });
  if (currentPassword === newPassword) return NextResponse.json({ error: 'Choose a password different from the current one.' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { id: true, passwordHash: true, status: true, role: true } });
  if (!user || user.status !== 'ACTIVE') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: 'Your current password is not correct.' }, { status: 400 });
  }

  const current = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false } }),
    prisma.session.deleteMany({ where: { userId: user.id, ...(current ? { NOT: { tokenHash: tokenHash(current) } } : {}) } }),
  ]);
  await writeAudit(user.id, 'PASSWORD_CHANGED');
  return NextResponse.json({ ok: true, redirectTo: String(user.role).toLowerCase() === 'faculty' ? '/faculty' : '/student' });
}
