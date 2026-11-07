import { randomBytes, createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requestPasswordResetSchema } from '@/lib/validation/schemas';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { clientIp } from '@/lib/auth/client-ip';
import { resetLinkOrigin, sendPasswordResetEmail } from '@/lib/email/password-reset';

// PasswordReset.token is stored hashed (same tokenHash pattern already used
// for sessions in api-auth.ts), so a database read alone never exposes a
// usable token — only the raw value returned to the caller once, here, does.
function hashResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = requestPasswordResetSchema.parse(body);
    const normalizedEmail = input.email.toLowerCase().trim();

    // Rate limit BEFORE touching the database. Keyed on the submitted email (so one
    // account cannot be flooded with reset requests) and on the client IP (so one
    // client cannot probe many addresses). Whether the email is registered has no
    // effect on this check, so it reveals nothing about which accounts exist.
    // The limiter is in-memory and per-process (see src/lib/auth/rate-limit.ts).
    for (const key of [`forgot:email:${normalizedEmail}`, `forgot:ip:${clientIp(req)}`]) {
      const check = checkRateLimit(key);
      if (!check.allowed) {
        return NextResponse.json(
          { error: `Too many reset requests. Try again in ${Math.ceil(check.retryAfterMs / 60000)} minutes.`, code: 'RATE_LIMITED', retryAfterMs: check.retryAfterMs },
          { status: 429 }
        );
      }
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Always return the same success response whether or not the email is
    // registered, and only do the real work when it is. Responding
    // differently for known vs. unknown emails would let a caller enumerate
    // registered accounts by trying addresses one at a time.
    if (user && user.status === 'ACTIVE') {
      const rawToken = randomBytes(32).toString('base64url');

      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          token: hashResetToken(rawToken),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          event: 'PASSWORD_RESET_REQUESTED',
          metadata: { email: normalizedEmail },
          ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        },
      });

      const origin = resetLinkOrigin(req.nextUrl.origin);
      if (!origin) {
        console.error('[PASSWORD_RESET] APP_URL is not set; refusing to build a reset link from the Host header.');
      } else {
        // Not awaited: waiting on SMTP would make responses for registered
        // emails measurably slower than for unknown ones (an enumeration
        // signal). sendPasswordResetEmail never throws; it logs failures.
        void sendPasswordResetEmail(normalizedEmail, `${origin}/reset-password?token=${rawToken}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email, password reset instructions have been sent.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Invalid request', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    console.error('[FORGOT_PASSWORD_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
