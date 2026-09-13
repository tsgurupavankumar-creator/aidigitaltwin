'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useAuthStore } from '@/store/authStore';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { Users, AlertTriangle, BookOpen, ArrowUpRight, BarChart3 } from 'lucide-react';
import Link from 'next/link';

export default function FacultyDashboardPage() {
  const authUser = useAuthStore((s) => s.user);
  const refreshSession = useAuthStore((s) => s.refreshSession);
  const students = useAppStore((s) => s.students);
  const interventions = useAppStore((s) => s.interventions);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const atRiskStudents = students.filter((s) => s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL');
  const facultyName = authUser?.name || 'Faculty';

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      {/* Editorial Header Hero */}
      <div className="p-8 rounded-md bg-paper-0 border border-paper-3 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="font-mono text-xs text-plum uppercase tracking-widest font-medium">
              01 / FACULTY GOVERNANCE & CLASS INTELLIGENCE
            </span>
            <h1 className="font-baskerville italic text-3xl sm:text-4xl text-ink-0">
              Welcome, {facultyName}
            </h1>
            <p className="font-mono text-xs text-ink-3 uppercase tracking-wider pt-1">
              DEPARTMENT OF COMPUTER SCIENCE • COHORT TELEMETRY AY 2025–26
            </p>
          </div>

          <div className="p-4 rounded bg-paper-1 border border-paper-3 text-right space-y-1 min-w-[200px]">
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3 block">AT-RISK COHORT</span>
            <div className="flex items-baseline justify-end gap-1">
              <AnimatedCounter value={atRiskStudents.length} className="text-3xl text-burgundy" />
              <span className="text-xs text-ink-2 font-mono">/ {students.length} Students</span>
            </div>
            <span className="text-[11px] text-ink-2 block">Action Required Immediately</span>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between font-mono text-xs text-ink-3 uppercase tracking-widest">
          <span>02 / COHORT SUMMARY VECTORS</span>
          <span>REAL-TIME STATISTICS</span>
        </div>
        <HairlineRule variant="plum" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
          <div className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-2">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">TOTAL ENROLLED</span>
            <p className="font-space font-bold text-3xl text-ink-0">{students.length}</p>
            <span className="text-xs text-ink-2">Across 3 Assigned Courses</span>
          </div>

          <div className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-2">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">AVERAGE CLASS HEALTH</span>
            <AnimatedCounter value={84} suffix="%" className="text-3xl text-plum" />
            <span className="text-xs text-olive font-mono">+2.4% vs Last Term</span>
          </div>

          <div className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-2">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">INTERVENTIONS DISPATCHED</span>
            <p className="font-space font-bold text-3xl text-navy">{interventions.length}</p>
            <span className="text-xs text-ink-2">88% Compliance Rate</span>
          </div>
        </div>
      </div>

      {/* Priority At-Risk Students Editorial Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between font-mono text-xs text-ink-3 uppercase tracking-widest">
          <span>03 / PRIORITY AT-RISK MONITOR</span>
          <Link href="/faculty/at-risk" className="text-plum hover:underline flex items-center gap-1 font-semibold">
            <span>VIEW ALL AT-RISK</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <HairlineRule variant="plum" />

        <div className="bg-paper-0 border border-paper-3 rounded-md overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-paper-3 bg-paper-1 text-[11px] font-mono uppercase tracking-widest text-ink-3">
                <th className="py-3 px-4">RISK</th>
                <th className="py-3 px-4">STUDENT NAME</th>
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4 text-right">ACADEMIC HEALTH</th>
                <th className="py-3 px-4 text-right">ATTENDANCE</th>
                <th className="py-3 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-3 text-xs font-dmsans">
              {students.slice(0, 5).map((st) => (
                <tr key={st.id} className="h-14 hover:bg-paper-1 transition-colors">
                  <td className="py-3 px-4">
                    {/* 8x8px Editorial Risk Square Indicator */}
                    <div
                      className={`w-2 h-2 ${
                        st.riskLevel === 'CRITICAL' || st.riskLevel === 'HIGH'
                          ? 'bg-burgundy'
                          : st.riskLevel === 'MEDIUM'
                          ? 'bg-mustard'
                          : 'bg-olive'
                      }`}
                    />
                  </td>
                  <td className="py-3 px-4 font-semibold text-ink-0">{st.name}</td>
                  <td className="py-3 px-4 font-mono text-ink-3">{st.id}</td>
                  <td className="py-3 px-4 text-right font-space font-bold text-ink-0">{st.academicHealth}%</td>
                  <td className="py-3 px-4 text-right font-space text-ink-2">{st.attendance}%</td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/faculty/student/${st.id}`}
                      className="text-plum hover:underline font-mono text-[11px] font-semibold"
                    >
                      INSPECT &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
