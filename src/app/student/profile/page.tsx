'use client';

import { useAuthStore } from '@/store/authStore';
import { UserCheck, ShieldCheck, Mail, BookOpen, Calendar, GraduationCap } from 'lucide-react';

export default function StudentProfilePage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink-0 tracking-tight flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-terracotta" />
            Student Digital Twin Profile
          </h2>
          <p className="text-xs text-ink-2">Authenticated student credentials & academic program details.</p>
        </div>
      </div>

      <div className="rounded-2xl bg-paper-1 border border-paper-3 p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-5 pb-6 border-b border-paper-3">
          <div className="w-20 h-20 rounded-2xl bg-terracotta flex items-center justify-center text-paper-0 font-bold text-2xl shadow-lg shadow-terracotta/15">
            {user?.name?.[0] || 'S'}
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-ink-0">{user?.name || 'Student Name'}</h3>
            <p className="text-xs text-terracotta font-mono font-semibold mt-0.5">Roll No: {user?.rollNumber || '24BCE0480'}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-terracotta/10 text-terracotta border border-terracotta/20">
                STUDENT ACCOUNT
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Active Security Token
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-ink-3 uppercase tracking-wider">Account Details</h4>
            
            <div className="flex items-center gap-3 p-3 rounded-xl bg-paper-0 border border-paper-3">
              <Mail className="w-4 h-4 text-terracotta" />
              <div>
                <p className="text-[11px] text-ink-3">Institutional Email</p>
                <p className="text-xs font-semibold text-ink-0">{user?.email || 'student@vit.ac.in'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-paper-0 border border-paper-3">
              <GraduationCap className="w-4 h-4 text-terracotta" />
              <div>
                <p className="text-[11px] text-ink-3">Department</p>
                <p className="text-xs font-semibold text-ink-0">{user?.department || 'Computer Science & Engineering'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold text-ink-3 uppercase tracking-wider">Academic Program</h4>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-paper-0 border border-paper-3">
              <BookOpen className="w-4 h-4 text-navy" />
              <div>
                <p className="text-[11px] text-ink-3">Assigned Cohort Class</p>
                <p className="text-xs font-semibold text-ink-0">{user?.class || 'CSE-101 (Academic Year 2025-26)'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-paper-0 border border-paper-3">
              <Calendar className="w-4 h-4 text-navy" />
              <div>
                <p className="text-[11px] text-ink-3">Security Verification Status</p>
                <p className="text-xs font-semibold text-emerald-700">Secure 256-bit HTTP-Only Session</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
