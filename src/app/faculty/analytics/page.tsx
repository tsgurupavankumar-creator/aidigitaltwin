'use client';

import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { StatCard } from '@/components/twin/StatCard';

interface Analytics {
  students: number; avgHealth: number | null; healthChangeVsLastWeek: number | null;
  assessedStudents: number; atRisk: number; notAtRiskRate: number | null;
  interventions: number; interventionsCompleted: number; completionRate: number | null;
  trend: Array<{ week: string; avgHealth: number | null; students: number }>;
}

export default function FacultyAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/faculty/analytics').then(async (r) => {
      if (!r.ok) { setError('Could not load analytics.'); return; }
      setData((await r.json()).data);
    }).catch(() => setError('Could not load analytics.'));
  }, []);

  if (error) return <p className="max-w-6xl mx-auto p-6 text-sm text-burgundy">{error}</p>;
  if (!data) return <p className="max-w-6xl mx-auto p-6 text-sm text-ink-2">Loading…</p>;
  const change = data.healthChangeVsLastWeek;
  const points = data.trend.filter((t) => t.avgHealth !== null);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-3">Class analytics</p>
        <h1 className="page-title font-libre italic font-normal text-4xl">Class analytics</h1>
        <p className="page-subtitle text-sm">Your students across all your courses, from their digital twins, risk assessments and your interventions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Average academic health" value={data.avgHealth} suffix="%" tone="text-plum"
          caption={change === null ? `${data.students} student${data.students === 1 ? '' : 's'}` : `${change >= 0 ? '+' : ''}${change} points vs a week ago · ${data.students} students`} />
        <StatCard label="Interventions" value={data.interventions}
          caption={data.interventions === 0 ? 'None created yet' : `${data.interventionsCompleted} completed (${data.completionRate}%)`} />
        <StatCard label="Not at high or critical risk" value={data.notAtRiskRate} suffix="%" decimals={data.notAtRiskRate === null ? 0 : 1} tone="text-olive"
          caption={data.assessedStudents === 0 ? undefined : `${data.assessedStudents - data.atRisk} of ${data.assessedStudents} assessed students (risk model)`} />
      </div>

      <div className="p-6 rounded-md bg-paper-0 border border-paper-3">
        <h3 className="font-dmsans font-semibold text-lg text-ink-0 mb-4">Average academic health by week</h3>
        {points.length < 2 ? (
          <p className="text-xs text-ink-2">Not enough history yet. A point is added each week once twins have updated (needs the twin-history migration).</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="#E8E2D9" strokeDasharray="3 3" />
                <XAxis dataKey="week" stroke="#9C958E" fontSize={11} fontFamily="JetBrains Mono" />
                <YAxis domain={[0, 100]} stroke="#9C958E" fontSize={11} fontFamily="JetBrains Mono" />
                <Tooltip />
                <Area type="monotone" dataKey="avgHealth" name="Average academic health (%)" stroke="#6B4E5C" strokeWidth={2} fill="#6B4E5C" fillOpacity={0.12} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
