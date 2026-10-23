import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { JWTPayloadData, TokenPayload, signToken, verifyToken } from './jwt';

import { SESSION_COOKIE_NAME, AUTH_COOKIE_NAME } from './constants';

// Re-exported so existing imports from '@/lib/auth/session' keep working.
export { SESSION_COOKIE_NAME, AUTH_COOKIE_NAME };

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(userId: string, ipAddress?: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ipAddress,
    },
  });

  return token;
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function setAuthCookie(payload: TokenPayload): Promise<string> {
  const token = await signToken(payload);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return token;
}

export async function createAuthenticatedSession(payload: TokenPayload, ipAddress?: string): Promise<string> {
  const token = await signToken(payload);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId: payload.userId,
      tokenHash: hashToken(token),
      expiresAt,
      ipAddress,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return token;
}

export async function getAuthSession(): Promise<JWTPayloadData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  // A valid signature is not enough: the session must still exist in the database.
  // Logout and password reset delete these rows, which is what actually revokes a
  // cookie that was already issued (a copied or stolen one included). Every login
  // and signup route stores sha256(token) with the same 7-day expiry as the cookie,
  // so legitimate sessions always match. (middleware.ts still checks the signature
  // only, because it runs on the Edge runtime where Prisma is unavailable.)
  const live = await prisma.session.findFirst({
    where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (!live) return null;

  return {
    id: payload.userId,
    userId: payload.userId,
    role: payload.role,
    email: payload.email,
  };
}

export async function getSessionFromCookie(): Promise<TokenPayload | null> {
  return getAuthSession();
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
