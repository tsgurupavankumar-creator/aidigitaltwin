import { isAtRiskLevel } from '@/lib/risk/at-risk';

/** Pure: faculty analytics from real records. Every number is null when there is no data. */
export interface AnalyticsInput {
  now: Date;
  students: Array<{ id: string; academicHealth: number | null; riskLevel: string | null }>;
  interventions: Array<{ completedAt: Date | null }>;
  snapshots: Array<{ studentId: string; createdAt: Date; academicHealth: number }>;
}

const WEEK = 7 * 86_400_000;
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const round1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

export function cohortAnalytics({ now, students, interventions, snapshots }: AnalyticsInput, weeks = 8) {
  const health = students.map((s) => s.academicHealth).filter((h): h is number => typeof h === 'number');
  const assessed = students.filter((s) => s.riskLevel);
  const atRisk = assessed.filter((s) => isAtRiskLevel(s.riskLevel as never)).length;

  // Weekly class health: for each week, every student's LAST snapshot up to the end of that week, averaged.
  const byStudent = new Map<string, Array<{ t: number; h: number }>>();
  for (const s of snapshots) byStudent.set(s.studentId, [...(byStudent.get(s.studentId) ?? []), { t: s.createdAt.getTime(), h: s.academicHealth }]);
  for (const list of byStudent.values()) list.sort((a, b) => a.t - b.t);
  const trend = Array.from({ length: weeks }, (_, i) => {
    const end = now.getTime() - (weeks - 1 - i) * WEEK;
    const values = [...byStudent.values()].map((list) => { let last: number | null = null; for (const p of list) { if (p.t <= end) last = p.h; else break; } return last; })
      .filter((v): v is number => v !== null);
    return { week: new Date(end).toISOString().slice(0, 10), avgHealth: round1(mean(values)), students: values.length };
  });
  // Change: latest weekly point vs the one before, both computed the same way (same kind of data).
  const latest = trend[trend.length - 1]?.avgHealth ?? null;
  const previous = trend[trend.length - 2]?.avgHealth ?? null;
  const avgHealth = round1(mean(health));

  return {
    students: students.length,
    avgHealth,
    healthChangeVsLastWeek: latest !== null && previous !== null ? round1(latest - previous) : null,
    assessedStudents: assessed.length,
    atRisk,
    /** Share of assessed students NOT at high/critical risk: what the risk model expects to pass. */
    notAtRiskRate: assessed.length ? round1((100 * (assessed.length - atRisk)) / assessed.length) : null,
    interventions: interventions.length,
    interventionsCompleted: interventions.filter((i) => i.completedAt).length,
    completionRate: interventions.length ? round1((100 * interventions.filter((i) => i.completedAt).length) / interventions.length) : null,
    trend,
  };
}
