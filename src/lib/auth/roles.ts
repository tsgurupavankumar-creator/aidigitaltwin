export type NormalizedRole = 'student' | 'faculty';

export function normalizeRole(role?: string | null): NormalizedRole | null {
  if (!role) return null;
  const lower = role.toLowerCase().trim();
  if (lower === 'student') return 'student';
  if (lower === 'faculty' || lower === 'teacher') return 'faculty';
  return null;
}

export function rolesMatch(a?: string | null, b?: string | null): boolean {
  return normalizeRole(a) === normalizeRole(b);
}

export function isStudentRole(role?: string | null): boolean {
  return normalizeRole(role) === 'student';
}

export function isFacultyRole(role?: string | null): boolean {
  return normalizeRole(role) === 'faculty';
}

export const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password'];

export function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  if (pathname.startsWith('/api/auth/')) return true;
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon.ico')) return true;
  return false;
}

export function isStudentRoute(pathname: string): boolean {
  return pathname.startsWith('/student') || pathname.startsWith('/api/student');
}

export function isFacultyRoute(pathname: string): boolean {
  return pathname.startsWith('/faculty') || pathname.startsWith('/api/faculty');
}