'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { SessionWarning } from '@/components/auth/SessionWarning';
import { useSession } from '@/hooks/useSession';

function FacultyLayoutInner({ children }: { children: React.ReactNode }) {
  useSession();

  return (
    <div className="flex h-screen bg-[#07090F] overflow-hidden text-slate-100 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          title="Faculty Intelligence Dashboard"
          description="Class-wide cognitive telemetry, at-risk monitoring & automated interventions"
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <SessionWarning />
    </div>
  );
}

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute expectedRole="faculty">
      <FacultyLayoutInner>{children}</FacultyLayoutInner>
    </ProtectedRoute>
  );
}
