'use client';

import { InlineEditor, send } from '@/components/twin/InlineEditor';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { Mail, GraduationCap, BookOpen, ShieldCheck } from 'lucide-react';

export default function FacultyProfilePage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-end gap-3">
        <span className="mr-auto inline-flex items-center gap-2 text-xs text-ink-2">Edit your details
          <InlineEditor id="profile-edit" fields={[{ name: 'fullName', label: 'Name', value: (user as any)?.faculty?.fullName ?? user?.name ?? '' }, { name: 'department', label: 'Department', value: (user as any)?.faculty?.department ?? '' }, { name: 'designation', label: 'Designation', value: (user as any)?.faculty?.designation ?? '' }]}
            onSave={async (v) => { const err = await send('/api/faculty/profile', 'PATCH', { fullName: v.fullName || undefined, department: v.department || undefined, designation: v.designation || undefined }); if (!err) window.location.reload(); return err; }} />
        </span>
        <Link href="/change-password" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-paper-3 bg-paper-0 text-xs font-semibold text-ink-0 hover:border-plum">
          <KeyRound className="w-3.5 h-3.5" /> Change password
        </Link>
      </div>
      <div className="space-y-2">
        <span className="font-mono text-xs text-plum uppercase tracking-widest font-medium">
          01 / PROFILE
        </span>
        <h1 className="font-baskerville italic font-normal text-4xl text-ink-0">
          Faculty profile
        </h1>
        <p className="text-sm text-ink-2 font-dmsans">
          Authenticated credentials, department, and teaching subjects.
        </p>
      </div>

      <HairlineRule variant="plum" />

      <div className="p-8 rounded-md bg-paper-0 border border-paper-3 space-y-6">
        <div className="flex items-center gap-5 pb-6 border-b border-paper-3">
          <div className="w-16 h-16 rounded-sm bg-plum text-paper-0 flex items-center justify-center font-fraunces font-bold text-2xl">
            {user?.name?.[0] || 'F'}
          </div>
          <div>
            <h2 className="font-baskerville font-bold text-2xl text-ink-0">{user?.name || '—'}</h2>
            <p className="font-mono text-xs text-plum mt-0.5">Faculty ID: {user?.facultyId || '—'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-3">
            <span className="font-mono text-[10px] text-ink-3 uppercase tracking-widest block font-medium">
              ACCOUNT INFORMATION
            </span>

            <div className="p-3 rounded bg-paper-1 border border-paper-3 space-y-1">
              <span className="text-[11px] text-ink-3 block font-mono">INSTITUTIONAL EMAIL</span>
              <p className="font-semibold text-ink-0">{user?.email || '—'}</p>
            </div>

            <div className="p-3 rounded bg-paper-1 border border-paper-3 space-y-1">
              <span className="text-[11px] text-ink-3 block font-mono">DEPARTMENT</span>
              <p className="font-semibold text-ink-0">{user?.department || '—'}</p>
            </div>
          </div>

          <div className="space-y-3">
            <span className="font-mono text-[10px] text-ink-3 uppercase tracking-widest block font-medium">
              TEACHING SUBJECTS
            </span>

            <div className="p-3 rounded bg-paper-1 border border-paper-3 space-y-2">
              <span className="text-[11px] text-ink-3 block font-mono">ASSIGNED COURSES</span>
              <div className="flex flex-wrap gap-1.5">
                {(user?.subjects || ['DBMS', 'Operating Systems', 'Cloud Architecture']).map((sub) => (
                  <span key={sub} className="text-xs font-mono px-2 py-0.5 rounded bg-plum-light text-plum border border-plum/20 font-medium">
                    {sub}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
