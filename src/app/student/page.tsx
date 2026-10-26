'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { Brain, TrendingUp, AlertTriangle, CheckCircle2, Clock, ArrowUpRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { KnowledgeGap, MetricItem } from '@/lib/types';
import { WhyPanel, type Explanation } from '@/components/twin/WhyPanel';
import { TwinExplorer } from '@/components/twin/TwinExplorer';

interface DigitalTwinResponse {
  academicHealth: number;
  performanceScore: number;
  attendanceScore: number;
  engagementScore: number;
  learningVelocity: number; // stored on a 0 to 1 scale, unlike the other scores (0 to 100)
}

interface RiskAssessmentResponse {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  explanation?: Explanation;
  factors?: Record<string, unknown>;
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const refreshSession = useAuthStore((s) => s.refreshSession);
  const [agentResults, setAgentResults] = useState<Array<{ agentType: string; confidence: number; reasoning: string }>>([]);
  const [isRunningAgents, setIsRunningAgents] = useState(false);
  const [agentError, setAgentError] = useState('');

  // Real digital-twin health + metrics + knowledge gaps, fetched from the
  // live API rather than the mock-data-backed store. `twin === null` means
  // "fetch hasn't resolved yet, or genuinely has no data" — the JSX below
  // falls back to the store's placeholder numbers only while loading, and
  // shows an explicit empty state (not a fake number) if the fetch
  // succeeds but returns no twin record.
  const [twin, setTwin] = useState<DigitalTwinResponse | null>(null);
  const [twinLoaded, setTwinLoaded] = useState(false);
  const [risk, setRisk] = useState<RiskAssessmentResponse | null>(null);
  const [knowledgeGaps, setKnowledgeGaps] = useState<KnowledgeGap[]>([]);
  const [gapsLoaded, setGapsLoaded] = useState(false);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!authUser?.studentId) return;

    let cancelled = false;

    fetch('/api/student/twin')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setTwin(json.data ?? null);
        setTwinLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setTwinLoaded(true);
      });

    fetch('/api/student/knowledge-gaps')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const rows: Array<{
          id: string;
          masteryScore: number;
          previousScore: number | null;
          trend: 'UP' | 'DOWN' | 'STABLE';
          concept: { name: string };
        }> = json.data ?? [];
        setKnowledgeGaps(
          rows.map((row) => ({
            id: row.id,
            concept: row.concept.name,
            mastery: row.masteryScore,
            // previousScore is nullable in the schema (a concept with only
            // one assessment has nothing to compare against yet) — fall
            // back to the current score so no artificial trend is implied.
            previousMastery: row.previousScore ?? row.masteryScore,
            trend: row.trend,
          }))
        );
        setGapsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setGapsLoaded(true);
      });

    fetch('/api/student/risk')
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setRisk(json.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setRisk(null);
      });

    return () => {
      cancelled = true;
    };
  }, [authUser?.studentId]);

  const studentName = authUser?.name ? authUser.name.split(' ')[0] : 'Student';

  const health = Math.round(twin?.academicHealth ?? 0);
  const metrics: MetricItem[] = twin
    ? [
        { label: 'Performance', value: Math.round(twin.performanceScore), change: 0, details: 'Assessment trajectory & examination scores' },
        { label: 'Attendance', value: Math.round(twin.attendanceScore), change: 0, details: 'Lecture check-ins and lab attendance' },
        { label: 'Engagement', value: Math.round(twin.engagementScore), change: 0, details: 'LMS participation, quizzes, and discussion posts' },
        { label: 'Learning Velocity', value: Math.round(twin.learningVelocity * 100), change: 0, details: 'Concept mastery acquisition rate over time' },
      ]
    : [];

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
      if (data.degraded) {
        // A predictive agent failed: the orchestrator saved nothing.
        const failed = Array.isArray(data.agentErrors)
          ? data.agentErrors.map((e: { agent: string }) => e.agent).join(', ')
          : 'some agents';
        setAgentError(`The review could not fully complete (${failed} unavailable), so nothing was saved. Please try again shortly.`);
      } else if (data.llm?.degraded) {
        // The review was saved; only the optional LLM wording step fell back.
        setAgentError('The optional LLM stage was unavailable; rule-based recommendations were used and the completed review was saved.');
      }

      // Refresh real twin and risk assessments from Prisma
      fetch('/api/student/twin')
        .then((res) => res.json())
        .then((json) => setTwin(json.data ?? null))
        .catch(() => {});

      fetch('/api/student/risk')
        .then((res) => res.json())
        .then((json) => setRisk(json.data ?? null))
        .catch(() => {});

      // Refresh all data domains affected by a completed review. These reads
      // also bypass browser caching; router.refresh updates any server-backed
      // route segments without requiring a full page reload.
      await Promise.allSettled([
        fetch('/api/student/alerts', { cache: 'no-store' }),
        fetch('/api/student/recommendations', { cache: 'no-store' }),
        fetch('/api/student/study-plan', { cache: 'no-store' }),
        fetch(`/api/agents/logs/${encodeURIComponent(authUser.studentId)}`, { cache: 'no-store' }),
      ]);
      router.refresh();
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
            </div>
            <span className="text-[11px] text-ink-2 font-inter block">
              {twinLoaded && !twin ? 'No digital twin data yet' : health >= 75 ? 'Strong Learning Trajectory' : health >= 50 ? 'Steady Progress' : 'Needs Attention'}
            </span>
            {risk ? <span className="text-[10px] font-mono uppercase tracking-wider text-ink-3">Risk: {risk.riskLevel} ({Math.round(risk.riskScore)}%)</span> : null}
          </div>
        </div>
      </div>
      {risk && (
        <WhyPanel
          explanation={risk.explanation}
          configSource={typeof risk.factors?.configSource === 'string' ? risk.factors.configSource : undefined}
        />
      )}

      <TwinExplorer whatIfEndpoint="/api/student/what-if" historyEndpoint="/api/student/history" audience="student" />

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
                {metric.history !== undefined ? (
                  <span className={`text-xs font-mono font-semibold ${metric.change >= 0 ? 'text-olive' : 'text-burgundy'}`}>
                    {metric.change >= 0 ? `↑ +${metric.change}%` : `↓ ${metric.change}%`}
                  </span>
                ) : null}
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
            {!gapsLoaded ? (
              <div className="p-4 text-xs text-ink-2">Loading knowledge gaps…</div>
            ) : knowledgeGaps.length === 0 ? (
              <div className="p-4 text-xs text-ink-2">No concept gaps below the mastery threshold right now.</div>
            ) : (
              knowledgeGaps.slice(0, 4).map((gap) => (
                <div key={gap.id} className="p-4 flex items-center justify-between hover:bg-paper-1 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-inter text-sm font-semibold text-ink-0">{gap.concept}</span>
                      {gap.subject ? (
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-paper-2 text-ink-2">
                          {gap.subject}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-ink-2">Retention score deficit identified</p>
                  </div>
                  <div className="text-right">
                    <AnimatedCounter value={gap.mastery} suffix="%" className="text-lg text-burgundy" />
                    <span className="text-[10px] font-mono text-ink-3 block">Target: 85%</span>
                  </div>
                </div>
              ))
            )}
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
