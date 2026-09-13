'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { cn } from '@/lib/utils';
import {
  Sliders,
  Sparkles,
  TrendingUp,
  Activity,
  X,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  BarChart3,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';

export interface DigitalTwinCardProps {
  health?: number;
  status?: string;
  trend?: number;
  metrics?: { label: string; value: number; change: number; history?: number[]; details?: string }[];
}

export function DigitalTwinCard(props: DigitalTwinCardProps) {
  const store = useAppStore();

  const baseHealth = props.health ?? store.health ?? 82;
  const baseStatus = props.status ?? store.status ?? 'GOOD';
  const baseTrend = props.trend ?? store.trend ?? 6;
  const baseMetrics = props.metrics ?? store.metrics ?? [
    { label: 'Performance', value: 84, change: 8 },
    { label: 'Attendance', value: 87, change: 3 },
    { label: 'Engagement', value: 76, change: -2 },
    { label: 'Learning Velocity', value: 81, change: 5 },
  ];

  // Interactive states
  const [timeframe, setTimeframe] = useState<'7D' | '30D' | 'SEMESTER'>('30D');
  const [showSimulator, setShowSimulator] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Simulator parameters
  const [studyHours, setStudyHours] = useState(6);
  const [practiceProblems, setPracticeProblems] = useState(30);
  const [remediatedGaps, setRemediatedGaps] = useState(false);

  // Timeframe modifiers
  const timeframeMultiplier = timeframe === '7D' ? 0.6 : timeframe === '30D' ? 1 : 1.4;

  // Calculate dynamic simulated health
  const simulatedHealthDelta = showSimulator
    ? Math.round((studyHours - 6) * 1.5 + (practiceProblems - 30) * 0.15 + (remediatedGaps ? 6 : 0))
    : 0;

  const currentHealth = Math.min(100, Math.max(20, baseHealth + simulatedHealthDelta));

  const currentStatus =
    currentHealth >= 85
      ? 'EXCELLENT'
      : currentHealth >= 70
      ? 'GOOD'
      : currentHealth >= 50
      ? 'MEDIUM'
      : 'CRITICAL';

  const statusColors = {
    EXCELLENT: 'text-cyan-400',
    GOOD: 'text-emerald-400',
    MEDIUM: 'text-amber-400',
    CRITICAL: 'text-red-400',
  };

  const handleSyncTwin = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      store.updateHealth(1);
    }, 1200);
  };

  const handleApplyDiagnosticRemedy = (boost: number) => {
    store.updateHealth(boost);
  };

  const activeMetricData = baseMetrics.find((m) => m.label === selectedMetric);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl bg-[#111722] border border-white/5 p-6 shadow-xl"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      <div className="relative">
        {/* Top Header & Interactive Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">Your Academic Digital Twin</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium flex items-center gap-1">
                <Activity className="w-2.5 h-2.5" /> Live Sync
              </span>
            </div>
            <p className="text-xs text-muted-foreground/80 mt-0.5">
              Multi-vector representation of your academic cognitive state
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Timeframe selector */}
            <div className="flex items-center bg-white/[0.03] border border-white/5 rounded-lg p-0.5 text-[11px]">
              {(['7D', '30D', 'SEMESTER'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    'px-2.5 py-1 rounded-md font-medium transition-colors',
                    timeframe === tf
                      ? 'bg-white/10 text-white'
                      : 'text-muted-foreground hover:text-slate-200'
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* What-If Simulator Toggle */}
            <button
              onClick={() => setShowSimulator(!showSimulator)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all border',
                showSimulator
                  ? 'bg-primary/20 border-primary/40 text-primary shadow-sm shadow-primary/20'
                  : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
              )}
              title="Toggle interactive What-If scenario simulator"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Simulator</span>
            </button>

            {/* Sync Twin Button */}
            <button
              onClick={handleSyncTwin}
              disabled={isSyncing}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white border border-white/5 transition-colors disabled:opacity-50"
              title="Sync Twin with latest assessment checkpoints"
            >
              <RotateCcw className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin text-primary')} />
            </button>
          </div>
        </div>

        {/* Circular Health Gauge & Summary */}
        <div className="flex items-center justify-between mt-2 flex-wrap gap-4">
          <div className="flex items-center gap-6">
            {/* Radial SVG Gauge (Clickable for Diagnostics) */}
            <div
              onClick={() => setShowDiagnostics(true)}
              className="relative w-28 h-28 cursor-pointer group"
              title="Click to view full health diagnostics & factor breakdown"
            >
              <svg className="w-28 h-28 -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r="46"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="8"
                  fill="none"
                />
                <motion.circle
                  cx="56"
                  cy="56"
                  r="46"
                  stroke="url(#healthGradient)"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: 289, strokeDashoffset: 289 }}
                  animate={{ strokeDashoffset: 289 - (currentHealth / 100) * 289 }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
                <defs>
                  <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#7C3AED" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none group-hover:scale-105 transition-transform">
                <AnimatedNumber value={currentHealth} className="text-3xl font-bold text-white tracking-tight" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Health</span>
              </div>

              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] bg-black/80 text-primary px-1.5 py-0.5 rounded border border-primary/20 pointer-events-none whitespace-nowrap">
                Inspect ↗
              </div>
            </div>

            {/* Health Info & Status */}
            <div>
              <div
                className={cn(
                  'text-xl font-bold tracking-wide transition-colors',
                  statusColors[currentStatus as keyof typeof statusColors] || 'text-emerald-400'
                )}
              >
                {currentStatus} STATUS
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {baseTrend > 0 ? '+' : ''}
                  {Math.round(baseTrend * timeframeMultiplier)} points vs last {timeframe.toLowerCase()}
                </span>
              </div>
              {showSimulator && simulatedHealthDelta !== 0 && (
                <div className="mt-1.5 text-xs text-cyan-400 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Simulated delta: {simulatedHealthDelta > 0 ? `+${simulatedHealthDelta}` : simulatedHealthDelta} pts</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Diagnostics Action Pill */}
          <button
            onClick={() => setShowDiagnostics(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-xs text-slate-300 font-medium transition-colors group"
          >
            <BarChart3 className="w-4 h-4 text-primary" />
            <span>Diagnostics Breakdown</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* What-If Simulator Panel (Interactive Sliders) */}
        <AnimatePresence>
          {showSimulator && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 p-4 rounded-xl bg-slate-950/80 border border-primary/30 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-white">What-If Cognitive Impact Simulator</span>
                </div>
                <button
                  onClick={() => {
                    setStudyHours(6);
                    setPracticeProblems(30);
                    setRemediatedGaps(false);
                  }}
                  className="text-[11px] text-muted-foreground hover:text-white flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                {/* Slider 1: Study hours */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Study Hours / Week</span>
                    <span className="text-white font-semibold">{studyHours} hrs</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="18"
                    step="1"
                    value={studyHours}
                    onChange={(e) => setStudyHours(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="text-[10px] text-muted-foreground/70">Baseline: 6 hrs</div>
                </div>

                {/* Slider 2: Practice Problems */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Weekly Practice Problems</span>
                    <span className="text-white font-semibold">{practiceProblems}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    step="5"
                    value={practiceProblems}
                    onChange={(e) => setPracticeProblems(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="text-[10px] text-muted-foreground/70">Baseline: 30 Qs</div>
                </div>

                {/* Checkbox: Remediate gaps */}
                <div className="flex flex-col justify-between">
                  <span className="text-muted-foreground mb-1.5">Knowledge Gap Remediation</span>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                    <input
                      type="checkbox"
                      checked={remediatedGaps}
                      onChange={(e) => setRemediatedGaps(e.target.checked)}
                      className="rounded accent-primary cursor-pointer"
                    />
                    <span className="text-slate-200 text-xs">Fix Critical Gaps (+6 pts)</span>
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Metrics Grid (Interactive Click to inspect) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {baseMetrics.map((metric, index) => {
            const isSelected = selectedMetric === metric.label;
            const dynamicValue = showSimulator
              ? Math.min(100, Math.max(20, Math.round(metric.value + simulatedHealthDelta * 0.7)))
              : metric.value;

            return (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                onClick={() => setSelectedMetric(isSelected ? null : metric.label)}
                className={cn(
                  'p-3.5 rounded-xl border transition-all cursor-pointer group',
                  isSelected
                    ? 'bg-white/[0.08] border-primary/50 shadow-md shadow-primary/5'
                    : 'bg-white/5 border-white/5 hover:bg-white/[0.07] hover:border-white/10'
                )}
              >
                <div className="flex items-center justify-between">
                  <AnimatedNumber value={dynamicValue} className="text-2xl font-bold text-white" />
                  <span className="text-xs text-muted-foreground/50 group-hover:text-primary transition-colors">
                    {isSelected ? '▲' : '▼'}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground mt-0.5">{metric.label}</div>

                <div
                  className={cn(
                    'text-xs mt-1.5 font-medium flex items-center gap-1',
                    metric.change >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  <span>{metric.change >= 0 ? '↑' : '↓'}</span>
                  <span>{Math.abs(metric.change)}%</span>
                  <span className="text-[10px] text-muted-foreground/60 font-normal">vs last month</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Selected Metric Detail Sheet */}
        <AnimatePresence>
          {activeMetricData && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/10"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-white">
                    {activeMetricData.label} Metric Deep Dive
                  </span>
                </div>
                <button
                  onClick={() => setSelectedMetric(null)}
                  className="text-muted-foreground hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {activeMetricData.details ||
                  `Real-time weighted score assessing your active engagement, accuracy in quizzes, and assignment adherence for ${activeMetricData.label}.`}
              </p>

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>Current Vector:</span>
                  <span className="text-white font-semibold">{activeMetricData.value}%</span>
                </div>
                <button
                  onClick={() => store.setMetricBoost(activeMetricData.label, 2)}
                  className="px-2.5 py-1 rounded-md bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Boost +2%</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Diagnostics Modal */}
      <AnimatePresence>
        {showDiagnostics && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#111722] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <h4 className="text-base font-semibold text-white">Digital Twin Diagnostics</h4>
                </div>
                <button
                  onClick={() => setShowDiagnostics(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-xs font-medium text-slate-300 mb-2">Cognitive Factor Breakdown</div>
                  <div className="space-y-2">
                    {[
                      { factor: 'Academic Consistency', score: 88, weight: '35%' },
                      { factor: 'Quiz Retention Rate', score: 74, weight: '25%' },
                      { factor: 'Practical Application', score: 91, weight: '25%' },
                      { factor: 'Exam Readiness Velocity', score: 79, weight: '15%' },
                    ].map((item) => (
                      <div key={item.factor} className="text-xs">
                        <div className="flex justify-between text-muted-foreground mb-1">
                          <span>{item.factor} <span className="opacity-50">({item.weight})</span></span>
                          <span className="text-white font-medium">{item.score}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-cyan-400 rounded-full"
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Remediation recommendations */}
                <div className="p-3 rounded-xl bg-emerald-400/10 border border-emerald-400/20 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>AI Recommendation for Score Optimization</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Revising Database Normalization and Deadlocks will elevate your Quiz Retention score by approximately +8%, projecting your Twin Health to 90 (EXCELLENT).
                  </p>
                  <button
                    onClick={() => {
                      handleApplyDiagnosticRemedy(3);
                      setShowDiagnostics(false);
                    }}
                    className="w-full mt-2 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs transition-colors"
                  >
                    Apply Optimization Plan (+3 Health Boost)
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

