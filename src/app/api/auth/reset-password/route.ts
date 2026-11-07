import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { resetPasswordSchema } from '@/lib/validation/schemas';
import { validatePasswordStrength } from '@/lib/auth/password';
import { checkRateLimit, resetRateLimit } from '@/lib/auth/rate-limit';
import { clientIp } from '@/lib/auth/client-ip';

function hashResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = resetPasswordSchema.parse(body);

    const strength = validatePasswordStrength(input.password);
    if (!strength.valid) {
      return NextResponse.json(
        { error: `Password must include: ${strength.errors.join(', ')}`, code: 'WEAK_PASSWORD' },
        { status: 400 }
      );
    }

    // Rate limit the token lookup (after cheap input validation, so typos and weak
    // passwords don't use up the budget). Cleared again on success.
    const rateKey = `reset:ip:${clientIp(req)}`;
    const rate = checkRateLimit(rateKey);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${Math.ceil(rate.retryAfterMs / 60000)} minutes.`, code: 'RATE_LIMITED', retryAfterMs: rate.retryAfterMs },
        { status: 429 }
      );
    }

    const tokenHashValue = hashResetToken(input.token);
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token: tokenHashValue },
      include: { user: true },
    });

    // A missing record, an already-used token, and an expired token are all
    // reported with the same generic error. Distinguishing them in the
    // response would tell a caller more than they need to know about
    // whether a given token value was ever valid in the first place.
    const isUsable =
      resetRecord &&
      !resetRecord.usedAt &&
      resetRecord.expiresAt.getTime() > Date.now() &&
      resetRecord.user.status === 'ACTIVE';

    if (!isUsable) {
      return NextResponse.json(
        { error: 'This reset link is invalid or has expired. Please request a new one.', code: 'INVALID_TOKEN' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash, mustChangePassword: false },
      }),
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
      // Delete this user's Session rows. NOTE: this does NOT yet revoke cookies that
      // were already issued. API authorization (getAuthSession in
      // src/lib/auth/session.ts) validates only the JWT's signature and 7-day
      // expiry and never reads this table, so an old cookie keeps working until it
      // expires. The rows are removed so that revocation takes effect the moment
      // getAuthSession starts checking them (see AUDIT_FIXES.md).
      prisma.session.deleteMany({
        where: { userId: resetRecord.userId },
      }),
    ]);

    resetRateLimit(rateKey);

    await prisma.auditLog.create({
      data: {
        userId: resetRecord.userId,
        event: 'PASSWORD_RESET_COMPLETED',
        metadata: {},
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Your password has been reset. You can now sign in with your new password.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Invalid request', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    console.error('[RESET_PASSWORD_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
