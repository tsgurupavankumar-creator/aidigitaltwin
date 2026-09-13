'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { NormalizedRole } from '@/lib/auth/roles';

interface RoleTabsProps {
  activeRole: NormalizedRole;
  onChange: (role: NormalizedRole) => void;
}

export function RoleTabs({ activeRole, onChange }: RoleTabsProps) {
  return (
    <div className="flex border-b border-paper-3 relative">
      <button
        type="button"
        onClick={() => onChange('student')}
        className={cn(
          'flex-1 py-3 text-xs sm:text-sm font-medium tracking-wide transition-colors relative text-center',
          activeRole === 'student' ? 'text-ink-0 font-semibold' : 'text-ink-2 hover:text-ink-0'
        )}
      >
        Student
        {activeRole === 'student' && (
          <motion.div
            layoutId="tab-active-underline"
            className="absolute bottom-0 left-0 right-0 h-[2px] bg-terracotta"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
      </button>

      <button
        type="button"
        onClick={() => onChange('faculty')}
        className={cn(
          'flex-1 py-3 text-xs sm:text-sm font-medium tracking-wide transition-colors relative text-center',
          activeRole === 'faculty' ? 'text-ink-0 font-semibold' : 'text-ink-2 hover:text-ink-0'
        )}
      >
        Faculty
        {activeRole === 'faculty' && (
          <motion.div
            layoutId="tab-active-underline"
            className="absolute bottom-0 left-0 right-0 h-[2px] bg-plum"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
      </button>
    </div>
  );
}
