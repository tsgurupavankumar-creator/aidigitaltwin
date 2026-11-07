'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { NormalizedRole, normalizeRole } from '@/lib/auth/roles';

export function useRoleGuard(expectedRole: NormalizedRole) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const refreshSession = useAuthStore((s) => s.refreshSession);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    let active = true;
    async function ensureSession() {
      // Login already verified the session. Avoid another competing request
      // during Next.js client-side navigation. Direct visits still verify it.
      if (!useAuthStore.getState().isAuthenticated) {
        await refreshSession();
      }
      if (active) setSessionChecked(true);
    }
    void ensureSession();
    return () => { active = false; };
  }, [refreshSession]);

  useEffect(() => {
    if (!sessionChecked || isLoading) return;
    if (!isAuthenticated || !role) {
      router.replace(`/login?role=${expectedRole}&redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    const actual = normalizeRole(role);
    const expected = normalizeRole(expectedRole);
    if (actual !== expected) {
      router.replace(actual === 'faculty' ? '/faculty' : '/student');
    }
  }, [sessionChecked, isLoading, isAuthenticated, role, expectedRole, router, pathname]);

  const isAllowed = sessionChecked && !isLoading && isAuthenticated &&
    normalizeRole(role) === normalizeRole(expectedRole);
  return {
    isAllowed,
    isLoading: !sessionChecked || isLoading,
    user,
    role,
  };
}
