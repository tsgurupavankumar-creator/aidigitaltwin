import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { JWTPayloadData, TokenPayload, signToken, verifyToken } from './jwt';

export const SESSION_COOKIE_NAME = 'ai_twin_session';
export const AUTH_COOKIE_NAME = SESSION_COOKIE_NAME;

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
  const cookieStore = cookies();

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
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

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
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
