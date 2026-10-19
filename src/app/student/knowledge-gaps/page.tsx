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
}

export default function KnowledgeGapsPage() {
  const [gaps, setGaps] = useState<ConceptGap[]>([]);
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
          01 / CONCEPT MASTERY DEFICITS
        </span>
        <h1 className="font-fraunces italic font-normal text-4xl text-ink-0">
          Knowledge Gap Vector Analysis
        </h1>
        <p className="text-sm text-ink-2 font-dmsans">
          Targeted concept weaknesses detected by your twin during recent quiz vector retention tests.
        </p>
      </div>

      <HairlineRule variant="accent" className="bg-mustard" />

      {loading ? (
        <div className="p-16 rounded-md bg-paper-0 border border-paper-3 flex flex-col items-center justify-center gap-3 text-ink-2">
          <Loader2 className="w-8 h-8 animate-spin text-mustard" />
          <span className="font-mono text-xs uppercase tracking-wider">Analyzing concept mastery graph...</span>
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
          <h3 className="font-semibold text-ink-0 text-sm">Zero Knowledge Gaps Detected</h3>
          <p className="text-xs text-ink-2">All concepts currently exceed the 70% mastery proficiency threshold.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {gaps.map((gap) => (
            <div key={gap.id} className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
                    DIFFICULTY LEVEL {gap.concept.difficulty}
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

              <div className="pt-3 border-t border-paper-3 flex items-center justify-between text-xs">
                <span className="text-ink-3 font-mono">
                  {gap.previousScore !== null ? `Previous: ${Math.round(gap.previousScore)}%` : 'Trend: ' + gap.trend}
                </span>
                <Link
                  href="/student/quizzes"
                  className="text-terracotta hover:underline font-semibold flex items-center gap-1"
                >
                  <span>Launch Remediation Drill</span>
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
