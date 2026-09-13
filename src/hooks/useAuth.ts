import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const refreshSession = useAuthStore((s) => s.refreshSession);

  useEffect(() => {
    // Initial sync with server cookie on mount
    refreshSession();
  }, [refreshSession]);

  return {
    user,
    role,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshSession,
  };
}
