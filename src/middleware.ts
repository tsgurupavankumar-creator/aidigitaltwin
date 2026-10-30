import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { normalizeRole } from '@/lib/auth/roles';
import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';
import { isCsrfDisabled, verifyCsrfToken } from '@/lib/auth/csrf';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Largest request body any API route accepts (the largest legitimate one, a CSV import, is 200 KB). */
export const MAX_API_BODY_BYTES = 1_000_000;

/**
 * Refuses oversized API request bodies BEFORE any route reads or validates them. This also mitigates
 * the zod 3 advisory GHSA-mrhx-c7xc-m3w5 (memory exhaustion on oversized collections), whose fix is
 * the zod 4 major version. A body without a declared length (chunked) cannot be checked in advance,
 * so it is refused; the app's own pages always send Content-Length.
 */
export function bodyTooLarge(req: NextRequest): NextResponse | null {
  if (SAFE_METHODS.has(req.method) || !req.nextUrl.pathname.startsWith('/api/')) return null;
  const length = req.headers.get('content-length');
  if (length === null) {
    return req.headers.get('transfer-encoding') ? NextResponse.json({ error: 'Request body length is required.' }, { status: 411 }) : null;
  }
  const n = Number(length);
  if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: 'Invalid Content-Length.' }, { status: 400 });
  return n > MAX_API_BODY_BYTES ? NextResponse.json({ error: 'Request is too large.' }, { status: 413 }) : null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js)$/)
  ) {
    return NextResponse.next();
  }

  const tooLarge = bodyTooLarge(req);
  if (tooLarge) return tooLarge;

  if (
    !SAFE_METHODS.has(req.method) &&
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/auth/login') &&
    !isCsrfDisabled()
  ) {
    const csrfOk = await verifyCsrfToken(req);
    if (!csrfOk) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const isStudentRoute = pathname.startsWith('/student');
  const isFacultyRoute = pathname.startsWith('/faculty');

  if (!isStudentRoute && !isFacultyRoute) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    const loginUrl = new URL(isStudentRoute ? '/login/student' : '/login/faculty', req.url);
    loginUrl.searchParams.set('error', 'session_required');
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyToken(token);

  if (!payload) {
    const loginUrl = new URL(isStudentRoute ? '/login/student' : '/login/faculty', req.url);
    loginUrl.searchParams.set('error', 'invalid_session');
    return NextResponse.redirect(loginUrl);
  }

  const normalizedRole = normalizeRole(payload.role);

  if (isStudentRoute && normalizedRole !== 'student') {
    const loginUrl = new URL('/login/faculty?error=wrong_role', req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isFacultyRoute && normalizedRole !== 'faculty') {
    const loginUrl = new URL('/login/student?error=wrong_role', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/student/:path*', '/faculty/:path*', '/api/:path*'],
};
