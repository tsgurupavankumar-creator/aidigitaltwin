'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, RefreshCw, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';

export function SessionWarning() {
  const router = useRouter();
  const sessionWarningOpen = useAuthStore((s) => s.sessionWarningOpen);
  const setSessionWarningOpen = useAuthStore((s) => s.setSessionWarningOpen);
  const updateLastActivity = useAuthStore((s) => s.updateLastActivity);
  const logout = useAuthStore((s) => s.logout);

  if (!sessionWarningOpen) return null;

  const handleExtend = () => {
    updateLastActivity();
    setSessionWarningOpen(false);
  };

  const handleLogoutNow = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-paper-0/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="max-w-md w-full rounded-2xl bg-paper-1 border border-mustard/30 p-6 shadow-xl space-y-5"
        >
          <div className="flex items-center gap-3 text-mustard">
            <div className="w-10 h-10 rounded-xl bg-mustard/10 flex items-center justify-center border border-mustard/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-ink-0 text-base">Session Inactivity Warning</h3>
              <p className="text-xs text-ink-2 flex items-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-mustard" />
                <span>Your session will expire in 5 minutes</span>
              </p>
            </div>
          </div>

          <p className="text-xs text-ink-1 leading-relaxed">
            Due to security policies for the AI Academic Digital Twin platform, inactive sessions are automatically logged out after 30 minutes. Would you like to stay signed in?
          </p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleLogoutNow}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-paper-0 hover:bg-burgundy/5 text-ink-1 hover:text-burgundy border border-paper-3 transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Log Out Now
            </button>
            <button
              type="button"
              onClick={handleExtend}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-terracotta hover:bg-terracotta/90 text-paper-0 shadow-md shadow-terracotta/15 transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Extend Session
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
