'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useAuthStore } from '@/store/authStore';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { Brain, TrendingUp, AlertTriangle, CheckCircle2, Clock, ArrowUpRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function StudentDashboardPage() {
  const authUser = useAuthStore((s) => s.user);
  const refreshSession = useAuthStore((s) => s.refreshSession);
  const health = useAppStore((s) => s.health);
  const metrics = useAppStore((s) => s.metrics);
  const knowledgeGaps = useAppStore((s) => s.knowledgeGaps);
  const tasks = useAppStore((s) => s.tasks);
  const [agentResults, setAgentResults] = useState<Array<{ agentType: string; confidence: number; reasoning: string }>>([]);
  const [isRunningAgents, setIsRunningAgents] = useState(false);
  const [agentError, setAgentError] = useState('');

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const studentName = authUser?.name ? authUser.name.split(' ')[0] : 'Student';

  const runWeeklyReview = async () => {
    if (!authUser?.studentId || isRunningAgents) return;
    setIsRunningAgents(true);
    setAgentError('');
    try {
      const response = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: authUser.studentId, event: 'weekly_review' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Agent review failed');
      setAgentResults(data.results || []);
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : 'Agent review failed');
    } finally {
      setIsRunningAgents(false);
    }
  };

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      {/* Editorial Hero Block */}
      <div className="p-8 rounded-md bg-paper-1 border border-paper-3 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="font-mono text-xs text-terracotta uppercase tracking-widest font-medium">
              01 / ACADEMIC COGNITIVE OVERVIEW
            </span>
            <h1 className="font-fraunces italic text-4xl sm:text-5xl text-ink-0">
              Good morning, {studentName}
            </h1>
            <p className="font-mono text-xs text-ink-3 uppercase tracking-wider pt-1">
              TODAY IS {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
            </p>
          </div>

          <div className="p-4 rounded bg-paper-0 border border-paper-3 text-right space-y-1 min-w-[200px]">
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3 block">DIGITAL TWIN HEALTH</span>
            <div className="flex items-baseline justify-end gap-1">
              <AnimatedCounter value={health} suffix="%" className="text-4xl text-terracotta" />
              <span className="text-xs text-olive font-mono font-semibold">↑ +6.2%</span>
            </div>
            <span className="text-[11px] text-ink-2 font-inter block">Optimum Learning Trajectory</span>
          </div>
        </div>
      </div>

      {/* Section 02 Metric Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between font-mono text-xs text-ink-3 uppercase tracking-widest">
          <span>02 / COGNITIVE METRIC VECTORS</span>
          <span>SPATIAL PERFORMANCE</span>
        </div>
        <HairlineRule />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="p-5 rounded-md bg-paper-0 border border-paper-3 hover:border-terracotta/40 transition-colors space-y-3"
            >
              <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3 block">
                {metric.label}
              </span>
              <div className="flex items-baseline justify-between">
                <AnimatedCounter value={metric.value} suffix="%" className="text-3xl text-ink-0" />
                <span className={`text-xs font-mono font-semibold ${metric.change >= 0 ? 'text-olive' : 'text-burgundy'}`}>
                  {metric.change >= 0 ? `↑ +${metric.change}%` : `↓ ${metric.change}%`}
                </span>
              </div>
              <p className="text-xs text-ink-2 leading-relaxed">{metric.details}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Section 03 Split Layout: Concept Gaps & AI Agent Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Knowledge Gaps (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between font-mono text-xs text-ink-3 uppercase tracking-widest">
            <span>03 / REMEDIATION KNOWLEDGE GAPS</span>
            <Link href="/student/knowledge-gaps" className="text-terracotta hover:underline flex items-center gap-1 font-semibold">
              <span>VIEW ALL</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <HairlineRule />

          <div className="bg-paper-0 border border-paper-3 rounded-md divide-y divide-paper-3">
            {knowledgeGaps.slice(0, 4).map((gap) => (
              <div key={gap.id} className="p-4 flex items-center justify-between hover:bg-paper-1 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-inter text-sm font-semibold text-ink-0">{gap.concept}</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-paper-2 text-ink-2">
                      {gap.subject || 'CS'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-2">Retention score deficit identified</p>
                </div>
                <div className="text-right">
                  <AnimatedCounter value={gap.mastery} suffix="%" className="text-lg text-burgundy" />
                  <span className="text-[10px] font-mono text-ink-3 block">Target: 85%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Agent Telemetry Activity Stream (1 Col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between font-mono text-xs text-ink-3 uppercase tracking-widest">
            <span>04 / AI TELEMETRY</span>
            <button
              type="button"
              onClick={runWeeklyReview}
              disabled={!authUser?.studentId || isRunningAgents}
              className="text-terracotta hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunningAgents ? 'RUNNING REVIEW...' : 'RUN WEEKLY REVIEW'}
            </button>
          </div>
          <HairlineRule />

          <div className="bg-paper-0 border border-paper-3 rounded-md p-4 space-y-4">
            {agentError ? <p className="text-xs text-burgundy">{agentError}</p> : null}
            {!agentResults.length && !agentError ? <p className="text-xs text-ink-2">Run a weekly review to query the live academic agents.</p> : null}
            {agentResults.map((agent) => (
              <div key={agent.agentType} className="pb-3 border-b border-paper-3 last:border-0 last:pb-0 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-olive animate-pulse" />
                    <span className="font-inter text-xs font-semibold text-ink-0">{agent.agentType.replaceAll('_', ' ')}</span>
                  </div>
                  <span className="font-mono text-[10px] text-ink-3">{Math.round(agent.confidence * 100)}% confidence</span>
                </div>
                <p className="text-[11px] text-ink-2 leading-tight pl-4">{agent.reasoning}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
