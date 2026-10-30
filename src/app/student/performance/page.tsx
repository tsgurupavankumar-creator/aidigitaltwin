'use client';

import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { StatCard } from '@/components/twin/StatCard';
import { formatGpaRange } from '@/lib/format/gpa-range';

interface PerformanceData {
  currentGrade: number | null;
  averageMark: number | null;
  predictedGpa: number | null;
  markRange: { low: number; high: number } | null;
  predictedAt: string | null;
  syllabusMastery: number | null;
  academicHealth: number | null;
  academicYear: string;
  history: Array<{ label: string; kind: 'quiz' | 'assignment'; date: string; score: number; classAvg: number | null }>;
}

export default function StudentPerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/student/performance').then(async (res) => {
      if (!res.ok) { setError('Could not load your performance.'); return; }
      setData((await res.json()).data);
    }).catch(() => setError('Could not load your performance.'));
  }, []);

  if (error) return <p className="max-w-6xl mx-auto p-6 text-sm text-burgundy">{error}</p>;
  if (!data) return <p className="max-w-6xl mx-auto p-6 text-sm text-ink-2">Loading…</p>;

  const mastery = data.syllabusMastery;
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-3">Performance</p>
        <h1 className="page-title font-instrument italic font-normal text-4xl">Performance &amp; grade forecast</h1>
        <p className="page-subtitle text-sm">Your marks on each quiz and assignment, compared with your class, and the grade the model predicts.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Current grade (10-point)" value={data.currentGrade} decimals={1} tone="text-navy"
          caption={data.averageMark === null ? undefined : `From your average mark so far: ${data.averageMark}%`} />
        <StatCard label="Predicted grade (10-point)"
          display={data.predictedGpa === null ? undefined : formatGpaRange(data.predictedGpa, data.markRange)}
          value={data.predictedGpa === null ? null : undefined} tone="text-olive"
          caption={data.predictedGpa === null ? undefined : data.markRange ? 'Likely range from the marks model (80% range)' : 'From the marks model'} />
        <StatCard label="Concept mastery" value={mastery} suffix="%"
          caption={mastery === null ? undefined : mastery >= 70 ? 'Average across assessed concepts' : 'Average across assessed concepts: needs reinforcement'} />
      </div>

      <div className="p-6 rounded-md bg-paper-0 border border-paper-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-dmsans font-semibold text-lg text-ink-0">Your marks vs the class average</h3>
          <span className="font-mono text-xs text-ink-3">AY {data.academicYear}</span>
        </div>
        {data.history.length === 0 ? (
          <p className="text-xs text-ink-2">No marked quizzes or assignments yet. They appear here once they are graded.</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.history} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <defs><linearGradient id="perf" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2C3E50" stopOpacity={0.2} /><stop offset="95%" stopColor="#2C3E50" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="#E8E2D9" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#9C958E" fontSize={11} fontFamily="JetBrains Mono" />
                <YAxis domain={[0, 100]} stroke="#9C958E" fontSize={11} fontFamily="JetBrains Mono" />
                <Tooltip />
                <Area type="monotone" dataKey="score" name="Your mark (%)" stroke="#2C3E50" strokeWidth={2} fill="url(#perf)" />
                <Line type="monotone" dataKey="classAvg" name="Class average (%)" stroke="#9C958E" strokeDasharray="4 4" dot={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
