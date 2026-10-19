'use client';

import { useRoleGuard } from '@/hooks/useRoleGuard';
import { NormalizedRole } from '@/lib/auth/roles';

interface ProtectedRouteProps {
  expectedRole: NormalizedRole;
  children: React.ReactNode;
}

export function ProtectedRoute({ expectedRole, children }: ProtectedRouteProps) {
  const { isAllowed, isLoading } = useRoleGuard(expectedRole);

  if (isLoading || !isAllowed) {
    return (
      <div className="min-h-screen bg-paper-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-paper-3 border-t-terracotta animate-spin" />
          <p className="text-xs text-ink-2 font-medium">Verifying security token & role claims...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
