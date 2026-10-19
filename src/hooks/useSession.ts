import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const TWENTY_FIVE_MINUTES_MS = 25 * 60 * 1000;

export function useSession() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const lastActivity = useAuthStore((s) => s.lastActivity);
  const updateLastActivity = useAuthStore((s) => s.updateLastActivity);
  const setSessionWarningOpen = useAuthStore((s) => s.setSessionWarningOpen);
  const logout = useAuthStore((s) => s.logout);

  // 1. Listen for user activity to extend session
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleUserActivity = () => {
      const now = Date.now();
      // Throttle updates to at most once per 10 seconds
      if (now - lastActivity > 10000) {
        updateLastActivity();
      }
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
    };
  }, [isAuthenticated, lastActivity, updateLastActivity]);

  // 2. Periodic timer checking session inactivity status
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      const inactiveDuration = Date.now() - lastActivity;

      if (inactiveDuration >= THIRTY_MINUTES_MS) {
        // Expiry reached -> Force logout
        logout().then(() => {
          router.replace('/login?error=session_expired');
        });
      } else if (inactiveDuration >= TWENTY_FIVE_MINUTES_MS) {
        // 25 mins reached -> Show 5-min session warning modal
        setSessionWarningOpen(true);
      } else {
        setSessionWarningOpen(false);
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, lastActivity, logout, router, setSessionWarningOpen]);
}
