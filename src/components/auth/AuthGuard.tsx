'use client';

import { ProtectedRoute } from './ProtectedRoute';
import { normalizeRole, NormalizedRole } from '@/lib/auth/roles';
import { UserRole } from '@/lib/types';

interface AuthGuardProps {
  expectedRole: UserRole;
  children: React.ReactNode;
}

export function AuthGuard({ expectedRole, children }: AuthGuardProps) {
  const normRole: NormalizedRole = normalizeRole(expectedRole) || 'student';
  return <ProtectedRoute expectedRole={normRole}>{children}</ProtectedRoute>;
}
