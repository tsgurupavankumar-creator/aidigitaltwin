'use client';

import { useAppStore } from '@/lib/store';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const performanceHistoryData = [
  { term: 'Quiz 1', score: 78, classAvg: 72 },
  { term: 'Quiz 2', score: 82, classAvg: 75 },
  { term: 'Midterm 1', score: 80, classAvg: 74 },
  { term: 'Quiz 3', score: 85, classAvg: 76 },
  { term: 'Assignment 1', score: 88, classAvg: 79 },
  { term: 'Midterm 2', score: 86, classAvg: 77 },
];

export default function PerformancePage() {
  const currentStudent = useAppStore((s) => s.currentStudent);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="space-y-2">
        <span className="font-mono text-xs text-navy uppercase tracking-widest font-medium">
          01 / ACADEMIC ASSESSMENT TRAJECTORY
        </span>
        <h1 className="font-instrument italic font-normal text-4xl text-ink-0">
          Performance Analytics & GPA Forecast
        </h1>
        <p className="text-sm text-ink-2 font-inter">
          Historical exam scores, assignment benchmarks, and predictive GPA trajectory modeling.
        </p>
      </div>

      <HairlineRule variant="navy" />

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-6 rounded-md bg-paper-1 border border-paper-3 space-y-2">
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">CUMULATIVE GPA</span>
          <p className="font-space font-bold text-3xl text-navy">3.82</p>
          <span className="text-xs text-olive font-mono">Top 5% of Department</span>
        </div>

        <div className="p-6 rounded-md bg-paper-1 border border-paper-3 space-y-2">
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">PREDICTED END-TERM GPA</span>
          <p className="font-space font-bold text-3xl text-olive">3.90</p>
          <span className="text-xs text-ink-2">+0.08 Projected Velocity</span>
        </div>

        <div className="p-6 rounded-md bg-paper-1 border border-paper-3 space-y-2">
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">SYLLABUS MASTERY RATE</span>
          <AnimatedCounter value={86} suffix="%" className="text-3xl text-ink-0" />
          <span className="text-xs text-navy font-mono">Ahead of Schedule</span>
        </div>
      </div>

      {/* Trajectory Chart */}
      <div className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-inter font-bold text-base text-ink-0">Assessment Vector History vs Class Benchmark</h3>
          <span className="font-mono text-xs text-ink-3">AY 2025–26</span>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={performanceHistoryData}>
              <defs>
                <linearGradient id="navyColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2C3E50" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2C3E50" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="term" stroke="#9C958E" fontSize={11} fontFamily="JetBrains Mono" />
              <YAxis domain={[60, 100]} stroke="#9C958E" fontSize={11} fontFamily="JetBrains Mono" />
              <Tooltip
                contentStyle={{ backgroundColor: '#FDFCFA', borderColor: '#E5DFD6', borderRadius: '6px' }}
              />
              <Area type="monotone" dataKey="score" stroke="#2C3E50" strokeWidth={2} fillOpacity={1} fill="url(#navyColor)" />
              <Area type="monotone" dataKey="classAvg" stroke="#9C958E" strokeWidth={1} strokeDasharray="3 3" fillOpacity={0} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
