'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useAuthStore } from '@/store/authStore';

/**
 * Hydrates the shared UI store from the authenticated API surface.
 * Components can stay focused on presentation/actions without importing mock data.
 */
export function DataHydrator() {
  const user = useAuthStore((state) => state.user);
  const setSession = useAppStore((state) => state.setSession);
  const hydrateFromApi = useAppStore((state) => state.hydrateFromApi);

  useEffect(() => {
    if (!user) return;
    setSession(user);
    void hydrateFromApi();
  }, [user, setSession, hydrateFromApi]);

  return null;
}
