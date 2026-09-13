import { create } from 'zustand';
import { SessionUser } from '@/lib/auth';
import { normalizeRole, NormalizedRole } from '@/lib/auth/roles';

interface AuthState {
  user: SessionUser | null;
  role: NormalizedRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  lastActivity: number;
  sessionWarningOpen: boolean;

  setUser: (user: SessionUser | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setSessionWarningOpen: (open: boolean) => void;
  updateLastActivity: () => void;
  
  login: (credentials: { identifier: string; secret: string; role: NormalizedRole }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  role: null,
  isLoading: true,
  isAuthenticated: false,
  lastActivity: Date.now(),
  sessionWarningOpen: false,

  setUser: (user) =>
    set({
      user,
      role: user?.role || null,
      isAuthenticated: !!user,
      isLoading: false,
      lastActivity: Date.now(),
    }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setSessionWarningOpen: (sessionWarningOpen) => set({ sessionWarningOpen }),

  updateLastActivity: () => set({ lastActivity: Date.now() }),

  login: async ({ identifier, secret, role }) => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: secret, role }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        set({ isLoading: false });
        return { success: false, error: data.error || 'Authentication failed' };
      }

      const normalizedUser = {
        ...data.user,
        role: normalizeRole(data.user.role) || role,
      };

      set({
        user: normalizedUser,
        role: normalizedUser.role,
        isAuthenticated: true,
        isLoading: false,
        lastActivity: Date.now(),
        sessionWarningOpen: false,
      });

      return { success: true };
    } catch (err) {
      set({ isLoading: false });
      return { success: false, error: 'Network error. Please try again.' };
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors during logout
    } finally {
      set({
        user: null,
        role: null,
        isAuthenticated: false,
        isLoading: false,
        sessionWarningOpen: false,
      });
    }
  },

  refreshSession: async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!res.ok) {
        set({ user: null, role: null, isAuthenticated: false, isLoading: false });
        return;
      }
      const data = await res.json();
      if (data.authenticated && data.user) {
        const normalizedUser = {
          ...data.user,
          role: normalizeRole(data.user.role),
        };

        if (!normalizedUser.role) {
          set({ user: null, role: null, isAuthenticated: false, isLoading: false });
          return;
        }

        set({
          user: normalizedUser,
          role: normalizedUser.role,
          isAuthenticated: true,
          isLoading: false,
          lastActivity: Date.now(),
        });
      } else {
        set({ user: null, role: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
