import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { normalizeRole } from '@/lib/auth/roles';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js)$/)
  ) {
    return NextResponse.next();
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
  matcher: ['/student/:path*', '/faculty/:path*'],
};
