import { MOCK_USERS, User } from '@/data/users';
import { JWTPayloadData } from './auth/jwt';
import { normalizeRole, NormalizedRole } from './auth/roles';

const SESSION_KEY = 'adt_session';

export interface SessionUser {
  id: string;
  role: NormalizedRole;
  name: string;
  email: string;
  studentId?: string;
  rollNumber?: string;
  facultyId?: string;
  department: string;
  class?: string;
  subjects?: string[];
  avatarUrl?: string;
}

export type Session = SessionUser;


export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function getLocalSession(): SessionUser | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function setLocalSession(session: SessionUser): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearLocalSession(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(SESSION_KEY);
}

// Keeping legacy function signatures for compatibility
export function getSession(): SessionUser | null {
  return getLocalSession();
}

export function clearSession(): void {
  clearLocalSession();
}

export function findUserByCredentials(
  identifier: string, // Roll Number or Faculty ID or Email
  secret: string,      // DOB or Password
  expectedRole: string
): User | null {
  const normRole = normalizeRole(expectedRole);
  if (!normRole) return null;

  const cleanIdent = identifier.trim().toLowerCase();
  const cleanSecret = secret.trim();

  return MOCK_USERS.find((user) => {
    if (user.role !== normRole) return false;

    if (normRole === 'student') {
      const matchRoll = user.rollNumber?.toLowerCase() === cleanIdent;
      const matchEmail = user.email.toLowerCase() === cleanIdent;
      const matchDob = user.dateOfBirth === cleanSecret || user.password === cleanSecret;
      return (matchRoll || matchEmail) && matchDob;
    } else {
      const matchFacId = user.facultyId?.toLowerCase() === cleanIdent;
      const matchEmail = user.email.toLowerCase() === cleanIdent;
      const matchPwd = user.password === cleanSecret;
      return (matchFacId || matchEmail) && matchPwd;
    }
  }) || null;
}

export function userToSession(user: User): SessionUser {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    rollNumber: user.rollNumber,
    facultyId: user.facultyId,
    department: user.department,
    class: user.class,
    subjects: user.subjects,
    avatarUrl: user.avatarUrl,
  };
}

export function userToJWTPayload(user: User): JWTPayloadData {
  return {
    id: user.id,
    userId: user.id,
    role: user.role === 'student' ? 'STUDENT' : 'FACULTY',
    name: user.name,
    email: user.email,
    rollNumber: user.rollNumber,
    facultyId: user.facultyId,
    department: user.department,
  };
}

export function logout(): void {
  clearLocalSession();
}
