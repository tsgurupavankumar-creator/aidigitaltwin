import { cookies } from 'next/headers';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

function tokenBytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const entry = cookieHeader.split(';').find((part) => part.trim().startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.trim().slice(name.length + 1)) : null;
}

// The token is now SIGNED: "<random>.<HMAC-SHA256(JWT_SECRET, 'csrf:' + random)>". Before,
// the server only checked that the cookie and the header were equal, so any value the
// client made up (for example one injected through a sibling subdomain) was accepted.
// Web Crypto is used so this also runs in the Edge middleware.
const encoder = new TextEncoder();

async function signature(random: string): Promise<string> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required to sign CSRF tokens');
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`csrf:${random}`));
  return tokenBytesToHex(new Uint8Array(mac));
}

export async function createSignedCsrfToken(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const random = tokenBytesToHex(bytes);
  return `${random}.${await signature(random)}`;
}

async function isServerIssued(token: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  return constantTimeEqual(parts[1], await signature(parts[0]));
}

export async function generateCsrfToken(): Promise<string> {
  const token = await createSignedCsrfToken();

  (await cookies()).set(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60,
  });

  return token;
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * CSRF_ENABLED=false is a local-development convenience only. It is ignored
 * when NODE_ENV is "production", so a stray env var cannot switch the
 * protection off on a deployed server.
 */
export function isCsrfDisabled(): boolean {
  return process.env.CSRF_ENABLED === 'false' && process.env.NODE_ENV !== 'production';
}

export async function verifyCsrfToken(request: Request): Promise<boolean> {
  if (isCsrfDisabled()) return true;

  const cookieToken = getCookieValue(request, CSRF_COOKIE);
  const headerToken = request.headers.get(CSRF_HEADER);
  if (!cookieToken || !headerToken) return false;
  if (!constantTimeEqual(cookieToken, headerToken)) return false;
  try {
    return await isServerIssued(cookieToken);
  } catch {
    return false; // no secret configured: fail closed
  }
}