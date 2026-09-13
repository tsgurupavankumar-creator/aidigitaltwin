'use client';

import { HairlineRule } from '@/components/ui/HairlineRule';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const analyticsData = [
  { week: 'Wk 1', avgHealth: 82 },
  { week: 'Wk 2', avgHealth: 84 },
  { week: 'Wk 3', avgHealth: 79 },
  { week: 'Wk 4', avgHealth: 81 },
  { week: 'Wk 5', avgHealth: 85 },
  { week: 'Wk 6', avgHealth: 88 },
];

export default function FacultyAnalyticsPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="space-y-2">
        <span className="font-mono text-xs text-plum uppercase tracking-widest font-medium">
          01 / COHORT TRAJECTORY
        </span>
        <h1 className="font-baskerville italic font-normal text-4xl text-ink-0">
          Cohort Cognitive Analytics
        </h1>
        <p className="text-sm text-ink-2 font-dmsans">
          Class-wide performance progression, knowledge stability, and risk mitigation metrics.
        </p>
      </div>

      <HairlineRule variant="plum" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-2">
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">COHORT HEALTH AVG</span>
          <AnimatedCounter value={84} suffix="%" className="text-3xl text-plum" />
          <span className="text-xs text-olive font-mono">+3.5% vs Prev Assessment</span>
        </div>

        <div className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-2">
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">DISPATCHED DIRECTIVES</span>
          <p className="font-space font-bold text-3xl text-navy">12 Active</p>
          <span className="text-xs text-ink-2">85% Compliance</span>
        </div>

        <div className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-2">
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">PREDICTED PASS RATE</span>
          <p className="font-space font-bold text-3xl text-olive">96.8%</p>
          <span className="text-xs text-ink-2">Based on AI vectoring</span>
        </div>
      </div>

      <div className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-4">
        <h3 className="font-inter font-bold text-base text-ink-0">Cohort Academic Progression</h3>
        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analyticsData}>
              <defs>
                <linearGradient id="plumColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6B4A5D" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6B4A5D" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="week" stroke="#9C958E" fontSize={11} fontFamily="JetBrains Mono" />
              <YAxis domain={[60, 100]} stroke="#9C958E" fontSize={11} fontFamily="JetBrains Mono" />
              <Tooltip
                contentStyle={{ backgroundColor: '#FDFCFA', borderColor: '#E5DFD6', borderRadius: '6px' }}
              />
              <Area type="monotone" dataKey="avgHealth" stroke="#6B4A5D" strokeWidth={2} fillOpacity={1} fill="url(#plumColor)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
