import { SignJWT, jwtVerify } from 'jose';

// Placeholder values that have been published in this repository's docs or
// examples. A secret anyone can read lets anyone forge a session token (and,
// with signed CSRF tokens, a CSRF token), so they are refused even though
// they are long enough.
const KNOWN_PLACEHOLDER_SECRETS = new Set([
  'generate-a-32-character-minimum-secret-here',
  'generate-another-32-char-secret-here',
]);
const PLACEHOLDER_PATTERN = /generate-|change[-_ ]?me|your[-_ ]?secret|secret[-_]here|placeholder/i;

/** True when `secret` is long enough and is not a published placeholder. */
export function isUsableSecret(secret: string | undefined | null): secret is string {
  if (!secret || secret.length < 32) return false;
  if (KNOWN_PLACEHOLDER_SECRETS.has(secret)) return false;
  if (PLACEHOLDER_PATTERN.test(secret)) return false;
  return true;
}

const rawSecret = process.env.JWT_SECRET;
if (!isUsableSecret(rawSecret)) {
  throw new Error(
    'JWT_SECRET is missing, too short (min 32 chars) or still the example placeholder. ' +
      'Generate one with `openssl rand -base64 48` and set it in .env before starting the server.'
  );
}

const JWT_SECRET_KEY = new TextEncoder().encode(rawSecret);

export type AuthRole = 'STUDENT' | 'FACULTY' | 'ADMIN' | 'student' | 'faculty';

export interface TokenPayload {
  userId: string;
  role: AuthRole;
  email: string;
  [key: string]: unknown;
}

export interface JWTPayloadData extends TokenPayload {
  id: string;
  name?: string;
}

export async function signToken(payload: TokenPayload): Promise<string> {
  const normalizedPayload = {
    ...payload,
    id: payload.userId,
    name: payload.name || '',
  };

  return new SignJWT(normalizedPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET_KEY);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const role = payload.role as AuthRole | undefined;

    if (!payload.userId && !payload.id) {
      return null;
    }

    return {
      userId: String(payload.userId ?? payload.id),
      role: role ?? 'STUDENT',
      email: String(payload.email || ''),
      ...payload,
    };
  } catch {
    return null;
  }
}

export async function signJWTToken(payload: JWTPayloadData): Promise<string> {
  return signToken({
    userId: payload.userId,
    role: payload.role,
    email: payload.email,
  });
}

export async function verifyJWTToken(token: string): Promise<JWTPayloadData | null> {
  const payload = await verifyToken(token);
  if (!payload) return null;

  return {
    id: payload.userId,
    userId: payload.userId,
    role: payload.role,
    email: payload.email,
  };
}
