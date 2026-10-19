'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, ClipboardList, FileQuestion, Upload } from 'lucide-react';
import { Loading, Panel, RefreshButton } from './ui';

interface Summary {
  studentCount: number;
  studentsWithTwin: number;
  averages: { academicHealth: number | null; knowledge: number | null; performance: number | null };
  courseAttendanceRate: number | null;
  lecturesRecorded: number;
  riskDistribution: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'NOT_ASSESSED', number>;
  atRiskCount: number;
  weakestConcepts: Array<{ conceptId: string; name: string; averageMastery: number; studentsBelow70: number; studentsAssessed: number }>;
  generatedAt: string;
}

const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

export function CourseActions({ courseId }: { courseId: string }) {
  const links = [
    { href: 'attendance', label: 'Mark attendance', icon: CalendarCheck },
    { href: 'grades', label: 'Assignments & grades', icon: ClipboardList },
    { href: 'quizzes', label: 'Quizzes', icon: FileQuestion },
    { href: 'import', label: 'Import CSV', icon: Upload },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {links.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={`/faculty/courses/${courseId}/${href}`} className="p-4 rounded-md bg-paper-0 border border-paper-3 hover:border-plum hover:bg-paper-1 transition-colors flex items-center gap-2 text-xs font-semibold text-ink-0">
          <Icon className="w-4 h-4 text-plum" />{label}
        </Link>
      ))}
    </div>
  );
}

export function CourseInsightPanel({ courseId }: { courseId: string }) {
  const [summary, setSummary] = useState<Summary | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/faculty/courses/${courseId}/insights`);
    setSummary(res.ok ? (await res.json()).insight : null);
  }, [courseId]);

  async function recompute() {
    setBusy(true);
    const res = await fetch(`/api/faculty/courses/${courseId}/insights`, { method: 'POST' });
    if (res.ok) setSummary((await res.json()).insight);
    setBusy(false);
  }

  useEffect(() => { load(); }, [load]);

  return (
    <Panel title="Class insight" actions={<RefreshButton onClick={recompute} busy={busy} />}>
      {summary === undefined ? <Loading /> : summary === null ? (
        <p className="text-xs text-ink-2">No insight yet. It is computed automatically after attendance, grades or quiz attempts are recorded, or press Refresh.</p>
      ) : (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 font-space">
            {[
              ['Attendance', pct(summary.courseAttendanceRate), `${summary.lecturesRecorded} lectures`],
              ['Avg health', pct(summary.averages.academicHealth), `${summary.studentsWithTwin}/${summary.studentCount} twins`],
              ['Avg knowledge', pct(summary.averages.knowledge), ''],
              ['Avg performance', pct(summary.averages.performance), ''],
              ['At risk', String(summary.atRiskCount), `${summary.riskDistribution.NOT_ASSESSED} not assessed`],
            ].map(([label, value, sub]) => (
              <div key={label} className="p-3 rounded bg-paper-1 border border-paper-3">
                <span className="font-mono text-[10px] text-ink-3 block uppercase">{label}</span>
                <span className="font-bold text-lg text-ink-0">{value}</span>
                {sub && <span className="block font-mono text-[10px] text-ink-3">{sub}</span>}
              </div>
            ))}
          </div>
          <div className="flex gap-3 font-mono text-[11px] text-ink-2">
            {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((l) => <span key={l}>{l}: <b className="text-ink-0">{summary.riskDistribution[l]}</b></span>)}
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">Weakest concepts</span>
            {summary.weakestConcepts.length === 0 ? <p className="text-ink-2 mt-1">No mastery data yet.</p> : (
              <ul className="mt-1 divide-y divide-paper-3">
                {summary.weakestConcepts.map((c) => (
                  <li key={c.conceptId} className="py-1.5 flex justify-between"><span className="text-ink-0">{c.name}</span><span className="font-mono text-ink-3">{c.averageMastery}% avg · {c.studentsBelow70}/{c.studentsAssessed} below 70%</span></li>
                ))}
              </ul>
            )}
          </div>
          <p className="font-mono text-[10px] text-ink-3">Updated {new Date(summary.generatedAt).toLocaleString()}</p>
        </div>
      )}
    </Panel>
  );
}
