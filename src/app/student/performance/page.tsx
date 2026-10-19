'use client';

import { useEffect, useState } from 'react';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { Loader2, RotateCcw, TrendingUp } from 'lucide-react';
import { formatGpaRange } from '@/lib/format/gpa-range';

interface PerformanceData {
  cumulativeGpa: number;
  predictedGpa: number;
  syllabusMastery: number;
  academicHealth: number;
  history: Array<{ term: string; score: number; classAvg: number }>;
}

export default function PerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPerformance = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/student/performance');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load performance data');
      setData(json.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load performance telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, []);

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

      {loading ? (
        <div className="p-16 rounded-md bg-paper-0 border border-paper-3 flex flex-col items-center justify-center gap-3 text-ink-2">
          <Loader2 className="w-8 h-8 animate-spin text-navy" />
          <span className="font-mono text-xs uppercase tracking-wider">Calculating GPA projections and telemetry vectors...</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-md bg-burgundy/10 border border-burgundy/20 space-y-3">
          <p className="text-sm font-semibold text-burgundy">{error}</p>
          <button
            onClick={fetchPerformance}
            className="px-3 py-1.5 text-xs font-mono rounded bg-navy text-paper-0 hover:bg-[#1E2B37] transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : !data ? (
        <div className="p-16 rounded-md bg-paper-0 border border-paper-3 text-center space-y-2">
          <TrendingUp className="w-8 h-8 text-ink-3 mx-auto" />
          <h3 className="font-semibold text-ink-0 text-sm">No Assessment Data Yet</h3>
          <p className="text-xs text-ink-2">Complete assignments or quizzes to populate your performance trajectory.</p>
        </div>
      ) : (
        <>
          {/* KPI Overview Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-6 rounded-md bg-paper-1 border border-paper-3 space-y-2">
              <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">CUMULATIVE GPA</span>
              <p className="font-space font-bold text-3xl text-navy">{data.cumulativeGpa.toFixed(2)}</p>
              <span className="text-xs text-olive font-mono">Live Academic Record</span>
            </div>

            <div className="p-6 rounded-md bg-paper-1 border border-paper-3 space-y-2">
              <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">PREDICTED END-TERM GPA</span>
              <p className="font-space font-bold text-3xl text-olive">{formatGpaRange(data.predictedGpa)}</p>
              <span className="text-xs text-ink-2 font-mono">
                {data.predictedGpa >= data.cumulativeGpa
                  ? `+${(data.predictedGpa - data.cumulativeGpa).toFixed(2)} Projected Velocity`
                  : `${(data.predictedGpa - data.cumulativeGpa).toFixed(2)} Projected Trajectory`}
              </span>
            </div>

            <div className="p-6 rounded-md bg-paper-1 border border-paper-3 space-y-2">
              <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">SYLLABUS MASTERY RATE</span>
              <AnimatedCounter value={data.syllabusMastery} suffix="%" className="text-3xl text-ink-0" />
              <span className="text-xs text-navy font-mono">
                {data.syllabusMastery >= 75 ? 'Ahead of Schedule' : 'Needs Reinforcement'}
              </span>
            </div>
          </div>

          {/* Trajectory Chart */}
          <div className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-inter font-bold text-base text-ink-0">
                Live Assessment Vector History vs Class Benchmark
              </h3>
              <span className="font-mono text-xs text-ink-3">AY 2025–26</span>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.history}>
                  <defs>
                    <linearGradient id="navyColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2C3E50" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2C3E50" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="term" stroke="#9C958E" fontSize={11} fontFamily="JetBrains Mono" />
                  <YAxis domain={[50, 100]} stroke="#9C958E" fontSize={11} fontFamily="JetBrains Mono" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#FDFCFA', borderColor: '#E5DFD6', borderRadius: '6px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    name="Your Score"
                    stroke="#2C3E50"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#navyColor)"
                  />
                  <Area
                    type="monotone"
                    dataKey="classAvg"
                    name="Class Benchmark"
                    stroke="#9C958E"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    fillOpacity={0}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
