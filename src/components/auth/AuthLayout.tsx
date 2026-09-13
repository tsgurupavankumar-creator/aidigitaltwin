import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function AuthLayout({ children, accent = 'terracotta' }: { children: ReactNode; accent?: 'terracotta' | 'plum' }) {
  return (
    <div className="min-h-screen bg-paper-0 px-4 py-10 text-ink-0">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <div className={cn('w-full', accent === 'terracotta' ? 'text-terracotta' : 'text-plum')}>
          {children}
        </div>
      </div>
    </div>
  );
}
