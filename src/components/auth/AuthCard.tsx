'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  accent?: 'terracotta' | 'plum';
  className?: string;
}

export function AuthCard({ title, subtitle, children, footer, accent = 'terracotta', className }: AuthCardProps) {
  const accentClasses = accent === 'terracotta' ? 'text-terracotta' : 'text-plum';

  return (
    <div className="w-full max-w-[420px] rounded-[12px] border border-paper-3 bg-paper-0 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]">
      <div className="p-7 sm:p-8">
        <div className="mb-7 flex items-center justify-center">
          <Link href="/" className="flex items-center gap-3 text-left">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold text-paper-0', accent === 'terracotta' ? 'bg-terracotta' : 'bg-plum')}>
              AT
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-3">Academic Twin</div>
              <div className="font-fraunces text-lg text-ink-0">AI Academic Digital Twin</div>
            </div>
          </Link>
        </div>

        <div className="mb-6 space-y-2 text-center">
          <h1 className={cn('font-instrument text-[2.25rem] leading-none tracking-[-0.04em]', accent === 'terracotta' ? 'text-ink-0' : 'text-ink-0')}>
            {title}
          </h1>
          <p className="text-[15px] text-ink-2">{subtitle}</p>
        </div>

        <div className={cn('space-y-5', className)}>{children}</div>
      </div>

      {footer ? <div className="border-t border-paper-3 px-6 py-4 text-center text-sm text-ink-2">{footer}</div> : null}
    </div>
  );
}
