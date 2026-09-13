'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Brain,
  TrendingUp,
  AlertTriangle,
  BookOpen,
  Sparkles,
  Users,
  BarChart3,
  Bell,
  GraduationCap,
  HelpCircle,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

const studentNavGroups = [
  {
    title: '01 / OVERVIEW',
    items: [
      { icon: LayoutDashboard, label: 'Overview', href: '/student' },
      { icon: Brain, label: 'Digital Twin', href: '/student/digital-twin' },
      { icon: TrendingUp, label: 'Performance', href: '/student/performance' },
    ],
  },
  {
    title: '02 / CURRICULUM',
    items: [
      { icon: AlertTriangle, label: 'Knowledge Gaps', href: '/student/knowledge-gaps' },
      { icon: BookOpen, label: 'Study Plan', href: '/student/study-plan' },
      { icon: Sparkles, label: 'AI Recommendations', href: '/student/recommendations' },
      { icon: HelpCircle, label: 'Quizzes & Drills', href: '/student/quizzes' },
      { icon: Bell, label: 'Early Warnings', href: '/student/alerts' },
    ],
  },
  {
    title: '03 / ACCOUNT',
    items: [
      { icon: UserCheck, label: 'Profile', href: '/student/profile' },
    ],
  },
];

const facultyNavGroups = [
  {
    title: '01 / GOVERNANCE',
    items: [
      { icon: LayoutDashboard, label: 'Overview', href: '/faculty' },
      { icon: GraduationCap, label: 'Courses', href: '/faculty/courses' },
      { icon: Users, label: 'Class Intelligence', href: '/faculty/students' },
    ],
  },
  {
    title: '02 / ANALYTICS',
    items: [
      { icon: AlertTriangle, label: 'At-Risk Students', href: '/faculty/at-risk' },
      { icon: Brain, label: 'Knowledge Gaps', href: '/faculty/knowledge-gaps' },
      { icon: BarChart3, label: 'Interventions', href: '/faculty/interventions' },
      { icon: TrendingUp, label: 'Cohort Analytics', href: '/faculty/analytics' },
    ],
  },
  {
    title: '03 / ACCOUNT',
    items: [
      { icon: UserCheck, label: 'Faculty Profile', href: '/faculty/profile' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const storeRole = useAuthStore((s) => s.role);

  const isStudent = storeRole === 'student' || pathname.startsWith('/student');
  const navGroups = isStudent ? studentNavGroups : facultyNavGroups;
  const accentColorClass = isStudent ? 'bg-terracotta' : 'bg-plum';

  return (
    <aside className="w-[240px] h-screen bg-paper-0 border-r border-paper-3 flex flex-col flex-shrink-0 z-30 select-none">
      {/* Header Logo */}
      <div className="h-16 px-5 border-b border-paper-3 flex items-center justify-between">
        <Link href={isStudent ? '/student' : '/faculty'} className="flex items-center gap-2.5">
          <div
            className={cn(
              'w-7 h-7 rounded-sm flex items-center justify-center text-paper-0 font-bold text-xs',
              isStudent ? 'bg-terracotta' : 'bg-plum'
            )}
          >
            AT
          </div>
          <div>
            <span className="font-fraunces font-bold text-base text-ink-0 leading-none block">
              Academic Twin
            </span>
            <span className="text-[10px] font-mono text-ink-3 tracking-widest uppercase block mt-1">
              {isStudent ? 'Student Edition' : 'Faculty Edition'}
            </span>
          </div>
        </Link>
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 p-3 overflow-y-auto space-y-5">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            <div className="px-3 text-[10px] font-mono font-medium tracking-widest text-ink-3 uppercase mb-1.5">
              {group.title}
            </div>
            {group.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/faculty' && item.href !== '/student' && pathname.startsWith(`${item.href}`));

              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={cn(
                      'h-10 px-3 flex items-center gap-3 rounded-md transition-colors text-sm relative group',
                      isActive
                        ? 'text-ink-0 font-semibold bg-paper-1'
                        : 'text-ink-2 hover:text-ink-0 hover:bg-paper-1/80 font-medium'
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active-indicator"
                        className={cn('absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full', accentColorClass)}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <item.icon
                      className={cn(
                        'w-4 h-4 flex-shrink-0 transition-colors',
                        isActive ? (isStudent ? 'text-terracotta' : 'text-plum') : 'text-ink-3 group-hover:text-ink-1'
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom Profile Footer */}
      <div className="p-3 border-t border-paper-3 bg-paper-1/50 text-xs">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md">
          <div
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-paper-0',
              isStudent ? 'bg-terracotta' : 'bg-plum'
            )}
          >
            {user?.name?.[0] || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-medium text-ink-0 text-xs truncate block">{user?.name || 'User Account'}</span>
            <span className="font-mono text-[10px] text-ink-3 truncate block">
              {user?.rollNumber || user?.facultyId || 'AY 2025-26'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
