'use client';

import { useEffect, useState } from 'react';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import Link from 'next/link';

interface ConceptGap {
  id: string;
  masteryScore: number;
  previousScore: number | null;
  trend: 'UP' | 'DOWN' | 'STABLE';
  confidenceLevel: number;
  concept: {
    id: string;
    name: string;
    difficulty: number;
    courseId: string;
  };
  course: { code: string; name: string };
  impact: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  rootCause: string | null;
  downstreamConcepts: string[];
}

export default function KnowledgeGapsPage() {
  const [gaps, setGaps] = useState<ConceptGap[]>([]);
  const [assessed, setAssessed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchKnowledgeGaps = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/student/knowledge-gaps');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load knowledge gaps');
      setGaps(json.data || []);
      setAssessed(json.assessed ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load concept gaps');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledgeGaps();
  }, []);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="space-y-2">
        <span className="font-mono text-xs text-mustard uppercase tracking-widest font-medium">
          01 / KNOWLEDGE GAPS
        </span>
        <h1 className="page-title font-fraunces italic font-normal text-4xl">
          Knowledge gaps
        </h1>
        <p className="page-subtitle text-sm font-dmsans">
          Concepts where your mastery is below 70%, from your quiz answers and graded work, with where the weakness may start.
        </p>
      </div>

      <HairlineRule variant="accent" className="bg-mustard" />

      {loading ? (
        <div className="p-16 rounded-md bg-paper-0 border border-paper-3 flex flex-col items-center justify-center gap-3 text-ink-2">
          <Loader2 className="w-8 h-8 animate-spin text-mustard" />
          <span className="font-mono text-xs uppercase tracking-wider">Loading…</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-md bg-burgundy/10 border border-burgundy/20 space-y-3">
          <p className="text-sm font-semibold text-burgundy">{error}</p>
          <button
            onClick={fetchKnowledgeGaps}
            className="px-3 py-1.5 text-xs font-mono rounded bg-mustard text-paper-0 hover:bg-[#D48806] transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : gaps.length === 0 ? (
        <div className="p-16 rounded-md bg-paper-0 border border-paper-3 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-olive mx-auto" />
          <h3 className="font-semibold text-ink-0 text-sm">{assessed === 0 ? 'Not assessed yet' : 'No knowledge gaps'}</h3>
          <p className="text-xs text-ink-2">{assessed === 0 ? 'Your gaps will show here once you have taken quizzes or had work graded.' : `All ${assessed} assessed concept${assessed === 1 ? ' is' : 's are'} at or above 70% mastery.`}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {gaps.map((gap) => (
            <div key={gap.id} className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
                    {gap.course.code} · Difficulty {gap.concept.difficulty} / 5{gap.impact ? ` · ${gap.impact} impact` : ''}
                  </span>
                  <h3 className="font-inter font-bold text-base text-ink-0 tracking-tight">
                    {gap.concept.name}
                  </h3>
                </div>
                <span className="font-space font-bold text-xl text-burgundy">
                  {Math.round(gap.masteryScore)}%
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-ink-2">
                  <span>Concept Mastery Progress</span>
                  <span className="font-mono">{Math.round(gap.masteryScore)} / 100</span>
                </div>
                <div className="w-full h-1.5 bg-paper-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-mustard rounded-full"
                    style={{ width: `${Math.round(gap.masteryScore)}%` }}
                  />
                </div>
              </div>

              {(gap.rootCause || gap.downstreamConcepts.length > 0) && (
                <p className="text-xs text-ink-2">
                  {gap.rootCause && <>The weakness may start in <strong>{gap.rootCause}</strong>, which this builds on: review that first. </>}
                  {gap.downstreamConcepts.length > 0 && <>Needed for {gap.downstreamConcepts.slice(0, 3).join(', ')}.</>}
                </p>
              )}
              <div className="pt-3 border-t border-paper-3 flex items-center justify-between text-xs">
                <span className="text-ink-3 font-mono">
                  {gap.previousScore !== null ? `Previous: ${Math.round(gap.previousScore)}%` : 'Trend: ' + gap.trend}
                </span>
                <Link
                  href={`/student/quizzes?concept=${gap.concept.id}`}
                  className="text-terracotta hover:underline font-semibold flex items-center gap-1"
                >
                  <span>Practise this concept</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
