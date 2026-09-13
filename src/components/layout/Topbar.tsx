'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bell, LogOut, User, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { RoleBadge } from './RoleBadge';
import { cn } from '@/lib/utils';

interface TopbarProps {
  title?: string;
  description?: string;
}

function getBreadcrumb(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return 'HOME';
  return parts.map((p) => p.toUpperCase().replace(/-/g, ' ')).join(' / ');
}

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Topbar({ title, description }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    router.replace(isStudent ? '/login/student' : '/login/faculty');
  };

  const initials = getInitials(user?.name);
  const breadcrumb = getBreadcrumb(pathname);
  const isStudent = role === 'student';

  return (
    <header className="h-16 border-b border-paper-3 px-6 flex items-center justify-between bg-paper-0 sticky top-0 z-20 select-none">
      {/* Left: Breadcrumbs in JetBrains Mono */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-ink-3 uppercase tracking-widest font-medium">
          {breadcrumb}
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Role Badge */}
        <RoleBadge role={role} />

        {/* AI Operational Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-paper-1 border border-paper-3 text-[11px] font-mono text-ink-2">
          <span className="w-2 h-2 rounded-full bg-olive animate-pulse" />
          <span>LIVE ENGINE</span>
        </div>

        {/* Notifications */}
        <button className="p-2 text-ink-2 hover:text-ink-0 hover:bg-paper-1 rounded-md transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-terracotta" />
        </button>

        {/* User Profile */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 p-1 rounded-md hover:bg-paper-1 transition-colors border border-transparent hover:border-paper-3"
          >
            <div
              className={cn(
                'w-7 h-7 rounded-sm flex items-center justify-center text-paper-0 font-bold text-xs',
                isStudent ? 'bg-terracotta' : 'bg-plum'
              )}
            >
              {initials}
            </div>
          </button>

          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute right-0 top-10 z-30 w-56 rounded-md bg-paper-0 border border-paper-3 shadow-md py-2 space-y-1 text-xs"
            >
              {user && (
                <div className="px-3.5 py-2 border-b border-paper-3 space-y-0.5">
                  <p className="font-semibold text-ink-0 truncate">{user.name}</p>
                  <p className="font-mono text-[10px] text-ink-3 truncate">{user.email}</p>
                </div>
              )}

              <button
                onClick={() => {
                  setMenuOpen(false);
                  router.push(isStudent ? '/student/profile' : '/faculty/profile');
                }}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-ink-1 hover:text-ink-0 hover:bg-paper-1 transition-colors"
              >
                <User className="w-3.5 h-3.5 text-ink-2" />
                Profile Settings
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-burgundy hover:bg-burgundy/10 transition-colors border-t border-paper-3 pt-2 font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </header>
  );
}
