'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  Info,
  Sliders,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '../ui/AnimatedNumber';

interface MilestoneData {
  label: string;
  current: number;
  predicted: number;
  classAvg?: number;
  weight?: string;
  topicFocus?: string;
  optimistic?: number;
  pessimistic?: number;
}

const subjectDatasets: Record<string, { name: string; baseConfidence: number; milestones: MilestoneData[] }> = {
  Overall: {
    name: 'All Subjects Aggregate',
    baseConfidence: 89,
    milestones: [
      { label: 'Quiz 1', current: 78, predicted: 80, classAvg: 72, weight: '10%', topicFocus: 'Foundations & Architecture' },
      { label: 'Quiz 2', current: 72, predicted: 76, classAvg: 70, weight: '10%', topicFocus: 'DBMS Normalization & Processes' },
      { label: 'Quiz 3', current: 74, predicted: 78, classAvg: 69, weight: '10%', topicFocus: 'Deadlocks & Transactions' },
      { label: 'Midterm', current: 76, predicted: 82, classAvg: 73, weight: '30%', topicFocus: 'Midterm Comprehensive' },
      { label: 'Final', current: 0, predicted: 84, classAvg: 74, weight: '40%', topicFocus: 'Final Capstone & Systems' },
    ],
  },
  DBMS: {
    name: 'Database Management Systems',
    baseConfidence: 86,
    milestones: [
      { label: 'Quiz 1', current: 82, predicted: 82, classAvg: 74, weight: '10%', topicFocus: 'ER Modeling & Relational Algebra' },
      { label: 'Quiz 2', current: 64, predicted: 70, classAvg: 68, weight: '10%', topicFocus: '3NF & BCNF Normalization' },
      { label: 'Quiz 3', current: 70, predicted: 76, classAvg: 71, weight: '10%', topicFocus: 'ACID & Concurrency Control' },
      { label: 'Midterm', current: 74, predicted: 80, classAvg: 72, weight: '30%', topicFocus: 'SQL & Relational Theory' },
      { label: 'Final', current: 0, predicted: 83, classAvg: 75, weight: '40%', topicFocus: 'Query Optimization & Storage' },
    ],
  },
  OS: {
    name: 'Operating Systems',
    baseConfidence: 91,
    milestones: [
      { label: 'Quiz 1', current: 75, predicted: 77, classAvg: 70, weight: '10%', topicFocus: 'System Calls & Forking' },
      { label: 'Quiz 2', current: 78, predicted: 80, classAvg: 72, weight: '10%', topicFocus: 'Process Synchronization' },
      { label: 'Quiz 3', current: 71, predicted: 75, classAvg: 68, weight: '10%', topicFocus: 'Banker’s Deadlock Algo' },
      { label: 'Midterm', current: 78, predicted: 84, classAvg: 74, weight: '30%', topicFocus: 'Threads & Scheduling' },
      { label: 'Final', current: 0, predicted: 86, classAvg: 76, weight: '40%', topicFocus: 'Virtual Memory & File Systems' },
    ],
  },
  CN: {
    name: 'Computer Networks',
    baseConfidence: 93,
    milestones: [
      { label: 'Quiz 1', current: 84, predicted: 85, classAvg: 75, weight: '10%', topicFocus: 'OSI Reference Model' },
      { label: 'Quiz 2', current: 86, predicted: 87, classAvg: 76, weight: '10%', topicFocus: 'TCP 3-Way Handshake' },
      { label: 'Quiz 3', current: 80, predicted: 83, classAvg: 73, weight: '10%', topicFocus: 'BGP & OSPF Routing' },
      { label: 'Midterm', current: 82, predicted: 86, classAvg: 77, weight: '30%', topicFocus: 'Transport & Network Layer' },
      { label: 'Final', current: 0, predicted: 89, classAvg: 78, weight: '40%', topicFocus: 'Application Protocols & Security' },
    ],
  },
};

export function PerformanceForecast() {
  const [activeSubjectKey, setActiveSubjectKey] = useState<string>('Overall');
  const [showExplanation, setShowExplanation] = useState(false);
  const [showConfidenceBounds, setShowConfidenceBounds] = useState(false);
  const [targetGrade, setTargetGrade] = useState<number>(90);
  const [studyEffortHours, setStudyEffortHours] = useState<number>(5);
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneData | null>(null);

  const activeDataset = subjectDatasets[activeSubjectKey] || subjectDatasets.Overall;

  // Compute dynamic predicted trajectory based on effort slider
  const effortDelta = studyEffortHours - 5;
  const effortMultiplier = 1 + effortDelta * 0.025;

  const dynamicChartData = activeDataset.milestones.map((m, idx) => {
    const isFuture = idx >= 3;
    const scaledPredicted = isFuture
      ? Math.min(99, Math.max(50, Math.round(m.predicted * effortMultiplier)))
      : m.predicted;

    const variance = (idx + 1) * 2;
    return {
      ...m,
      predicted: scaledPredicted,
      optimistic: Math.min(100, scaledPredicted + variance),
      pessimistic: Math.max(40, scaledPredicted - variance),
    };
  });

  const finalMilestone = dynamicChartData[dynamicChartData.length - 1];
  const predictedFinalScore = finalMilestone.predicted;
  const targetGap = predictedFinalScore - targetGrade;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#111722] border border-white/5 p-6 relative overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-white">Performance Forecast</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 font-medium flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" /> Monte Carlo ML
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Historical trajectory &amp; AI model projection with interactive scenario simulation
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Target Grade Selector */}
          <div className="flex items-center bg-white/[0.03] border border-white/5 rounded-lg p-0.5 text-[11px]">
            {[
              { label: 'Target B (80%)', value: 80 },
              { label: 'Target A (90%)', value: 90 },
              { label: 'Target A+ (95%)', value: 95 },
            ].map((tgt) => (
              <button
                key={tgt.value}
                onClick={() => setTargetGrade(tgt.value)}
                className={cn(
                  'px-2 py-1 rounded-md font-medium transition-colors whitespace-nowrap',
                  targetGrade === tgt.value
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-muted-foreground hover:text-white'
                )}
              >
                {tgt.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-muted-foreground hover:text-white border border-white/5"
            title="Toggle AI Insight Explainer"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Subject Switcher Tabs */}
      <div className="flex items-center gap-1.5 mb-4 p-0.5 rounded-lg bg-white/[0.03] border border-white/5 overflow-x-auto text-[11px]">
        {Object.keys(subjectDatasets).map((key) => (
          <button
            key={key}
            onClick={() => {
              setActiveSubjectKey(key);
              setSelectedMilestone(null);
            }}
            className={cn(
              'px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap',
              activeSubjectKey === key
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-muted-foreground hover:text-white'
            )}
          >
            {key === 'Overall' ? 'Overall Trajectory' : key}
          </button>
        ))}
      </div>

      {/* Interactive Effort Simulator Slider */}
      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 mb-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold text-slate-200">Simulate Study Effort:</span>
            <span className="text-white font-bold bg-primary/20 px-2 py-0.5 rounded border border-primary/30">
              {studyEffortHours} hrs / week
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showConfidenceBounds}
                onChange={(e) => setShowConfidenceBounds(e.target.checked)}
                className="accent-primary rounded"
              />
              <span>95% Confidence Bounds</span>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[10px] text-muted-foreground">2h (Passive)</span>
          <input
            type="range"
            min="2"
            max="14"
            step="1"
            value={studyEffortHours}
            onChange={(e) => setStudyEffortHours(Number(e.target.value))}
            className="w-full accent-primary cursor-pointer"
          />
          <span className="text-[10px] text-muted-foreground">14h (Sprint)</span>
        </div>
      </div>

      {/* Area Chart Container */}
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={dynamicChartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            onClick={(e) => {
              if (e && e.activePayload && e.activePayload[0]) {
                setSelectedMilestone(e.activePayload[0].payload as MilestoneData);
              }
            }}
          >
            <defs>
              <linearGradient id="currentGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="predictedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="boundsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" stroke="#64748B" fontSize={11} />
            <YAxis stroke="#64748B" fontSize={11} domain={[40, 100]} />
            <Tooltip
              contentStyle={{
                background: '#0D111A',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                fontSize: '12px',
                color: '#fff',
              }}
            />

            {/* Target Grade Reference Line */}
            <ReferenceLine
              y={targetGrade}
              stroke="#F59E0B"
              strokeDasharray="4 4"
              label={{
                value: `Goal: ${targetGrade}%`,
                fill: '#F59E0B',
                fontSize: 10,
                position: 'insideTopRight',
              }}
            />

            {/* Confidence bounds */}
            {showConfidenceBounds && (
              <Area
                type="monotone"
                dataKey="optimistic"
                name="Upper Bound (95%)"
                stroke="transparent"
                fill="url(#boundsGradient)"
              />
            )}

            <Area
              type="monotone"
              dataKey="current"
              name="Current Score"
              stroke="#7C3AED"
              strokeWidth={2}
              fill="url(#currentGradient)"
            />
            <Area
              type="monotone"
              dataKey="predicted"
              name="AI Projected"
              stroke="#06B6D4"
              strokeWidth={2}
              strokeDasharray="5 5"
              fill="url(#predictedGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Selected Milestone Drilldown Card */}
      <AnimatePresence>
        {selectedMilestone && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 p-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-white">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>Assessment Milestone: {selectedMilestone.label}</span>
              </div>
              <button
                onClick={() => setSelectedMilestone(null)}
                className="text-muted-foreground hover:text-white text-[11px]"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div>
                <span className="text-muted-foreground block">Actual Score:</span>
                <span className="text-white font-bold">{selectedMilestone.current || 'Pending'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">AI Projection:</span>
                <span className="text-cyan-400 font-bold">{selectedMilestone.predicted}%</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Class Cohort Avg:</span>
                <span className="text-slate-300 font-medium">{selectedMilestone.classAvg}%</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Final Weightage:</span>
                <span className="text-amber-400 font-medium">{selectedMilestone.weight}</span>
              </div>
            </div>
            {selectedMilestone.topicFocus && (
              <div className="text-[11px] text-muted-foreground/80 pt-1">
                Core syllabus coverage: <strong className="text-slate-200">{selectedMilestone.topicFocus}</strong>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score and Gap Summary Footer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-4 pt-4 border-t border-white/5 gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Predicted Final Grade Score</div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <AnimatedNumber
              value={predictedFinalScore}
              className="text-3xl font-bold text-white tracking-tight"
            />
            <span className="text-sm font-semibold text-white">%</span>

            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium ml-2',
                targetGap >= 0
                  ? 'bg-emerald-400/20 text-emerald-400 border border-emerald-400/30'
                  : 'bg-red-400/20 text-red-400 border border-red-400/30'
              )}
            >
              {targetGap >= 0 ? `+${targetGap}% on track for Goal` : `${targetGap}% below target`}
            </span>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <div className="text-xs text-muted-foreground">Model Confidence Interval</div>
          <div className="text-sm font-semibold text-emerald-400 mt-0.5">
            {activeDataset.baseConfidence}% Bounds
          </div>
          <div className="text-[10px] text-muted-foreground/60">Updated with recent quiz vectors</div>
        </div>
      </div>

      {/* AI Explanation / Dynamic Advice */}
      {showExplanation && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 p-4 rounded-xl bg-white/5 border border-white/5 text-xs text-muted-foreground leading-relaxed space-y-2"
        >
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Sparkles className="w-4 h-4" />
            <span>AI Predictive Synthesis:</span>
          </div>
          <p>
            {targetGap >= 0 ? (
              <span>
                At your simulated effort of <strong className="text-white">{studyEffortHours} hrs/week</strong>, you are{' '}
                <strong className="text-emerald-400">{targetGap}% ahead</strong> of your target goal of {targetGrade}%. Sustaining current lab velocity will lock in an A grade.
              </span>
            ) : (
              <span>
                Your projected final score is currently <strong className="text-amber-400">{Math.abs(targetGap)}% short</strong> of your {targetGrade}% target. Increasing weekly study from {studyEffortHours} hrs to {studyEffortHours + Math.ceil(Math.abs(targetGap) / 2)} hrs focusing on DBMS Normalization will bridge the deficit.
              </span>
            )}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

