'use client';

import { useEffect, useState } from 'react';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { Sparkles, Check, ArrowRight, Loader2, RotateCcw } from 'lucide-react';
import { WhyPanel, type Explanation } from '@/components/twin/WhyPanel';

interface RecommendationItem {
  id: string;
  agentType: string;
  title: string;
  actionType: string;
  confidence: number;
  createdAt: string;
  reason: string | null;
  appliedAt: string | null;
  concept: { id: string; name: string } | null;
}

interface RiskExplanation {
  explanation?: Explanation;
  factors?: Record<string, unknown>;
}

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [risk, setRisk] = useState<RiskExplanation | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError('');
    try {
      const [recommendationResponse, riskResponse] = await Promise.all([
        fetch('/api/student/recommendations'),
        fetch('/api/student/risk'),
      ]);
      const [recommendationJson, riskJson] = await Promise.all([
        recommendationResponse.json(),
        riskResponse.json(),
      ]);
      if (!recommendationResponse.ok) throw new Error(recommendationJson.error || 'Failed to load recommendations');
      if (!riskResponse.ok) throw new Error(riskJson.error || 'Failed to load risk explanation');
      setRecommendations(recommendationJson.data || []);
      setAppliedIds(new Set((recommendationJson.data || []).filter((r: RecommendationItem) => r.appliedAt).map((r: RecommendationItem) => r.id)));
      setRisk(riskJson.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const [applyError, setApplyError] = useState('');
  const applyRecommendation = async (id: string) => {
    setApplyingId(id); setApplyError('');
    try {
      const res = await fetch('/api/student/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId: id }),
      });
      if (res.ok) setAppliedIds((prev) => new Set(prev).add(id));
      else setApplyError((await res.json().catch(() => ({}))).error ?? 'Could not add it to your study plan.');
    } catch {
      setApplyError('Could not add it to your study plan.');
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="space-y-2">
        <span className="font-mono text-xs text-terracotta uppercase tracking-widest font-medium">
          01 / RECOMMENDATIONS
        </span>
        <h1 className="page-title font-fraunces italic font-normal text-4xl">
          What to work on next
        </h1>
        <p className="page-subtitle text-sm font-inter">
          From your latest review: each recommendation says what to do and why. Add the ones you want to your study plan.
        </p>
      </div>

      <HairlineRule variant="terracotta" />
      {risk && (
        <WhyPanel
          explanation={risk.explanation}
          configSource={typeof risk.factors?.configSource === 'string' ? risk.factors.configSource : undefined}
        />
      )}

      {loading ? (
        <div className="p-12 rounded-md bg-paper-0 border border-paper-3 flex flex-col items-center justify-center gap-3 text-ink-2">
          <Loader2 className="w-6 h-6 animate-spin text-terracotta" />
          <span className="font-mono text-xs uppercase tracking-wider">Loading recommendations…</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-md bg-burgundy/10 border border-burgundy/20 space-y-3">
          <p className="text-sm font-semibold text-burgundy">{error}</p>
          <button
            onClick={fetchRecommendations}
            className="px-3 py-1.5 text-xs font-mono rounded bg-terracotta text-paper-0 hover:bg-[#B4512D] transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="p-12 rounded-md bg-paper-0 border border-paper-3 text-center space-y-2">
          <Sparkles className="w-8 h-8 text-terracotta mx-auto" />
          <h3 className="font-semibold text-ink-0 text-sm">No recommendations yet</h3>
          <p className="text-xs text-ink-2">They appear after your first review. Run one from your dashboard, or they will appear once your marks and attendance are recorded.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {applyError && <p role="alert" className="md:col-span-2 text-xs text-burgundy">{applyError}</p>}
          {recommendations.map((rec) => {
            const isApplied = appliedIds.has(rec.id);
            return (
              <div
                key={rec.id}
                className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-terracotta bg-terracotta/10 px-2 py-0.5 rounded border border-terracotta/20 font-semibold">
                      {rec.concept ? rec.concept.name : rec.actionType === 'REVIEW' ? 'Attendance' : 'General'}
                    </span>
                    <span className="font-mono text-[10px] text-ink-3" title="How confident the analysis models were in this review, not a rating of the advice">Model confidence {Math.round(rec.confidence * 100)}%</span>
                  </div>
                  <h3 className="font-inter font-bold text-base text-ink-0 leading-snug">{rec.title}</h3>
                  {rec.reason && <p className="text-xs text-ink-2 leading-relaxed">{rec.reason}</p>}
                </div>

                <div className="pt-4 border-t border-paper-3 flex items-center justify-between">
                  <span className="text-xs font-mono text-ink-3">{new Date(rec.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                  {rec.concept ? (
                  <button
                    onClick={() => applyRecommendation(rec.id)}
                    disabled={isApplied || applyingId === rec.id}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-sm bg-terracotta hover:bg-[#B4512D] text-paper-0 transition-colors flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {applyingId === rec.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isApplied ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5" />
                    )}
                    <span>{isApplied ? 'In your study plan' : 'Add to study plan'}</span>
                  </button>
                  ) : <span className="text-[11px] text-ink-3">General advice</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
