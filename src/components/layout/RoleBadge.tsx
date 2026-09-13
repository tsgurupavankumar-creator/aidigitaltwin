'use client';

import { NormalizedRole } from '@/lib/auth/roles';
import { cn } from '@/lib/utils';

interface RoleBadgeProps {
  role?: NormalizedRole | string | null;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const isStudent = role?.toLowerCase() === 'student';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium border bg-paper-1 border-paper-3 text-ink-1',
        isStudent ? 'hover:border-terracotta/40' : 'hover:border-plum/40'
      )}
    >
      <span
        className={cn(
          'w-2 h-2 rounded-full',
          isStudent ? 'bg-terracotta' : 'bg-plum'
        )}
      />
      <span className="font-mono text-[11px] uppercase tracking-wider text-ink-2">
        {isStudent ? 'STUDENT ACCOUNT' : 'FACULTY ACCOUNT'}
      </span>
    </div>
  );
}
