'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { ArrowUpRight, Loader2, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { StatCard } from '@/components/twin/StatCard';
import { academicYear } from '@/lib/twin/academic-year';
import type { RiskLevel } from '@/lib/types';
import { isAtRiskLevel } from '@/lib/risk/at-risk';

interface FacultyStudentRow {
  id: string;
  fullName: string;
  riskAssessments: Array<{ riskLevel: RiskLevel; riskScore: number }>;
  digitalTwin: { academicHealth: number; attendanceScore: number } | null;
  rollNumber: string;
  attendanceRate: number | null;
}

interface FacultyInterventionRow {
  id: string;
  completedAt: string | null;
}

export default function FacultyDashboardPage() {
  const authUser = useAuthStore((s) => s.user);
  const refreshSession = useAuthStore((s) => s.refreshSession);

  const [students, setStudents] = useState<FacultyStudentRow[]>([]);
  const [interventions, setInterventions] = useState<FacultyInterventionRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!authUser?.id) return;
    let cancelled = false;

    setLoaded(false);
    setError('');
    Promise.all([
      fetch('/api/faculty/students', { cache: 'no-store' }).then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load student roster');
        return json;
      }),
      fetch('/api/faculty/intervention', { cache: 'no-store' }).then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load intervention queue');
        return json;
      }),
    ])
      .then(([studentsJson, interventionsJson]) => {
        if (cancelled) return;
        setStudents(studentsJson.data ?? []);
        setInterventions(interventionsJson.data ?? []);
        setLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load faculty dashboard data');
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authUser?.id, retryKey]);

  const facultyName = authUser?.name || 'Faculty';

  // Real data once `loaded` is true; the mock list only backs the roster
  // table's row count while the fetch is in flight, and is replaced
  // entirely — never merged — once real data arrives.
  const displayStudents = loaded ? students : [];
  const atRiskStudents = displayStudents.filter((s) => {
    const level = s.riskAssessments[0]?.riskLevel;
    return isAtRiskLevel(level);
  });

  // Highest risk score first.
  const priority = [...atRiskStudents].sort((a, b) => (b.riskAssessments[0]?.riskScore ?? 0) - (a.riskAssessments[0]?.riskScore ?? 0));

  const healthValues = displayStudents
    .map((s) => s.digitalTwin?.academicHealth)
    .filter((v): v is number => typeof v === 'number');
  const avgClassHealth = healthValues.length
    ? Math.round(healthValues.reduce((sum, v) => sum + v, 0) / healthValues.length)
    : null;

  const completedInterventions = interventions.filter((i) => i.completedAt !== null).length;
  const compliancePct = interventions.length
    ? Math.round((completedInterventions / interventions.length) * 100)
    : null;

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      {/* Editorial Header Hero */}
      <div className="p-8 rounded-md bg-paper-0 border border-paper-3 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="font-mono text-xs text-plum uppercase tracking-widest font-medium">
              01 / OVERVIEW
            </span>
            <h1 className="font-baskerville italic text-3xl sm:text-4xl text-ink-0">
              Welcome, {facultyName}
            </h1>
            <p className="font-mono text-xs text-ink-3 uppercase tracking-wider pt-1">
              {(authUser?.department || 'Department not set').toUpperCase()} • ACADEMIC YEAR {academicYear()}
            </p>
          </div>

          <div className="p-4 rounded bg-paper-1 border border-paper-3 text-right space-y-1 min-w-[200px]">
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3 block">AT HIGH OR CRITICAL RISK</span>
            <div className="flex items-baseline justify-end gap-1">
              <AnimatedCounter value={atRiskStudents.length} className="text-3xl text-burgundy" />
              <span className="text-xs text-ink-2 font-mono">/ {displayStudents.length} Students</span>
            </div>
            <span className="text-[11px] text-ink-2 block">
              {atRiskStudents.length > 0 ? 'Action Required' : loaded ? 'No students currently at risk' : 'Loading…'}
            </span>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between font-mono text-xs text-ink-3 uppercase tracking-widest">
          <span>02 / CLASS SUMMARY</span>
          <span>FROM THE LATEST TWIN UPDATES</span>
        </div>
        <HairlineRule variant="plum" />

      {error && (
        <div className="p-5 rounded-md bg-burgundy/10 border border-burgundy/20 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-burgundy">Dashboard data could not be loaded.</p>
            <p className="text-xs text-ink-2 mt-1">{error}</p>
          </div>
          <button
            onClick={() => { setLoaded(false); setError(''); setRetryKey((value) => value + 1); }}
            className="px-3 py-1.5 text-xs font-mono rounded bg-plum text-paper-0 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
          <StatCard label="Students" value={loaded ? displayStudents.length : null} caption="Enrolled in your courses" />
          <StatCard label="Average academic health" value={avgClassHealth} suffix="%" tone="text-plum" caption="Across your students' twins" />
          <StatCard label="Interventions" value={loaded ? interventions.length : null} tone="text-navy"
            caption={compliancePct !== null ? `${completedInterventions} completed (${compliancePct}%)` : 'None created yet'} />
        </div>
      </div>

      {/* Priority At-Risk Students Editorial Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between font-mono text-xs text-ink-3 uppercase tracking-widest">
          <span>03 / STUDENTS AT HIGH OR CRITICAL RISK</span>
          <Link href="/faculty/at-risk" className="text-plum hover:underline flex items-center gap-1 font-semibold">
            <span>VIEW ALL AT-RISK</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <HairlineRule variant="plum" />

        <div className="bg-paper-0 border border-paper-3 rounded-md overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-paper-3 bg-paper-1 text-[11px] font-mono uppercase tracking-widest text-ink-3">
                <th className="py-3 px-4">RISK</th>
                <th className="py-3 px-4">STUDENT NAME</th>
                <th className="py-3 px-4">ROLL NUMBER</th>
                <th className="py-3 px-4 text-right">ACADEMIC HEALTH</th>
                <th className="py-3 px-4 text-right">ATTENDANCE</th>
                <th className="py-3 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-3 text-xs font-dmsans">
              {!loaded ? (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-center text-ink-2">Loading roster…</td>
                </tr>
              ) : priority.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-center text-ink-2">{displayStudents.length === 0 ? 'No students assigned to your courses yet.' : "No student's latest risk assessment is high or critical."}</td>
                </tr>
              ) : (
                priority.slice(0, 5).map((st) => {
                  const riskLevel = st.riskAssessments[0]?.riskLevel;
                  return (
                    <tr key={st.id} className="h-14 hover:bg-paper-1 transition-colors">
                      <td className="py-3 px-4">
                        {/* 8x8px Editorial Risk Square Indicator */}
                        <div
                          className={`w-2 h-2 ${
                            riskLevel === 'CRITICAL' || riskLevel === 'HIGH'
                              ? 'bg-burgundy'
                              : riskLevel === 'MEDIUM'
                              ? 'bg-mustard'
                              : 'bg-olive'
                          }`}
                        />
                      </td>
                      <td className="py-3 px-4 font-semibold text-ink-0">{st.fullName}</td>
                      <td className="py-3 px-4 font-mono text-ink-3">{st.rollNumber}</td>
                      <td className="py-3 px-4 text-right font-space font-bold text-ink-0">
                        {st.digitalTwin ? `${Math.round(st.digitalTwin.academicHealth)}%` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-space text-ink-2">
                        {st.attendanceRate === null ? '—' : `${st.attendanceRate}%`}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/faculty/student/${st.id}`}
                          className="text-plum hover:underline font-mono text-[11px] font-semibold"
                        >
                          INSPECT &rarr;
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
}

