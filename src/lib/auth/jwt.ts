import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'ai-academic-digital-twin-secure-secret-key-2026'
);

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
