'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { SessionWarning } from '@/components/auth/SessionWarning';
import { useSession } from '@/hooks/useSession';

function StudentLayoutInner({ children }: { children: React.ReactNode }) {
  useSession();

  return (
    <div className="flex h-screen bg-[#07090F] overflow-hidden text-slate-100 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          title="Student Academic Digital Twin"
          description="Real-time cognitive performance graph & dynamic study path"
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <SessionWarning />
    </div>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute expectedRole="student">
      <StudentLayoutInner>{children}</StudentLayoutInner>
    </ProtectedRoute>
  );
}
