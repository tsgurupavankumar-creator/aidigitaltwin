'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { NormalizedRole, normalizeRole } from '@/lib/auth/roles';

export function useRoleGuard(expectedRole: NormalizedRole) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, isLoading, isAuthenticated, refreshSession } = useAuthStore();
  const hasRefreshed = useRef(false);

  useEffect(() => {
    if (!hasRefreshed.current) {
      hasRefreshed.current = true;
      refreshSession();
    }
  }, [refreshSession]);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !role) {
      router.replace(`/login?role=${expectedRole}&redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    const normalizedRole = normalizeRole(role);
    const normalizedExpected = normalizeRole(expectedRole);

    if (normalizedRole !== normalizedExpected) {
      console.warn(
        `[CLIENT GUARD] Role mismatch (${role} vs expected ${expectedRole}). Redirecting...`
      );
      router.replace(normalizedRole === 'faculty' ? '/faculty' : '/student');
    }
  }, [isLoading, isAuthenticated, role, expectedRole, router, pathname]);

  const normalizedRole = normalizeRole(role);
  const normalizedExpected = normalizeRole(expectedRole);

  return {
    isAllowed: !isLoading && isAuthenticated && normalizedRole === normalizedExpected,
    isLoading,
    user,
    role,
  };
}