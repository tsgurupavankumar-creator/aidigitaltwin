'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
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
  const [ml, setMl] = useState<{ online: boolean; modelsLoaded: boolean } | null>(null);
  const [notes, setNotes] = useState<{ count: number; items: Array<{ id: string; text: string; at: string; href: string }> } | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  useEffect(() => {
    if (!user) return;
    const load = () => {
      fetch('/api/ml/status').then((r) => (r.ok ? r.json() : null)).then((b) => b && setMl(b)).catch(() => setMl({ online: false, modelsLoaded: false }));
      fetch('/api/notifications').then((r) => (r.ok ? r.json() : null)).then((b) => b && setNotes(b)).catch(() => {});
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, [user]);

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
        <div title={ml === null ? 'Checking the ML service…' : ml.online ? (ml.modelsLoaded ? 'ML service running, both models loaded' : 'ML service running, models not loaded') : 'ML service not reachable: predictions are unavailable'}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-paper-1 border border-paper-3 text-[11px] font-mono text-ink-2">
          <span className={`w-2 h-2 rounded-full ${ml === null ? 'bg-paper-3' : ml.online && ml.modelsLoaded ? 'bg-olive' : 'bg-burgundy'}`} />
          <span>{ml === null ? 'ML …' : ml.online && ml.modelsLoaded ? 'ML ONLINE' : 'ML OFFLINE'}</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button type="button" aria-label={`Notifications${notes?.count ? ` (${notes.count})` : ''}`} aria-expanded={bellOpen}
            onClick={() => setBellOpen((v) => !v)}
            className="p-2 text-ink-2 hover:text-ink-0 hover:bg-paper-1 rounded-md transition-colors relative">
            <Bell className="w-4 h-4" />
            {!!notes?.count && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-terracotta text-paper-0 text-[10px] leading-4 text-center">{notes.count > 9 ? '9+' : notes.count}</span>}
          </button>
          {bellOpen && (
            <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-paper-0 border border-paper-3 rounded-md shadow-lg z-50 text-xs">
              <div className="px-3 py-2 border-b border-paper-3 flex justify-between items-center">
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">Notifications</span>
                {isStudent && !!notes?.count && <button type="button" className="text-plum hover:underline" onClick={async () => { await fetch('/api/notifications', { method: 'PATCH' }); setNotes({ count: 0, items: [] }); }}>Mark all read</button>}
              </div>
              {!notes?.items.length ? <p className="p-3 text-ink-2">Nothing new.</p> : (
                <ul className="max-h-80 overflow-y-auto divide-y divide-paper-3">
                  {notes.items.map((n) => (
                    <li key={n.id}><Link href={n.href} onClick={() => setBellOpen(false)} className="block p-3 hover:bg-paper-1 text-ink-1">{n.text}<span className="block text-[10px] text-ink-3 mt-0.5">{new Date(n.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span></Link></li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-label="Open user profile menu"
            aria-expanded={menuOpen}
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
                type="button"
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
                type="button"
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
