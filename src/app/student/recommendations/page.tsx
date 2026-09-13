'use client';

import { useAppStore } from '@/lib/store';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { Sparkles, Check, ArrowRight } from 'lucide-react';

export default function RecommendationsPage() {
  const recommendations = useAppStore((s) => s.recommendations);
  const applyRecommendation = useAppStore((s) => s.applyRecommendation);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="space-y-2">
        <span className="font-mono text-xs text-terracotta uppercase tracking-widest font-medium">
          01 / AI AGENT DISPATCHES
        </span>
        <h1 className="font-fraunces italic font-normal text-4xl text-ink-0">
          Targeted Learning Recommendations
        </h1>
        <p className="text-sm text-ink-2 font-inter">
          Prescriptive focus actions calculated by your autonomous digital twin monitor.
        </p>
      </div>

      <HairlineRule variant="terracotta" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {recommendations.map((rec) => (
          <div key={rec.id} className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-terracotta bg-terracotta-light px-2 py-0.5 rounded border border-terracotta/20">
                  {rec.confidence}% CONFIDENCE
                </span>
                <span className="font-mono text-xs text-ink-3">{rec.timeToComplete || '15 mins'}</span>
              </div>
              <h3 className="font-inter font-bold text-base text-ink-0 leading-snug">{rec.title}</h3>
              <p className="text-xs text-ink-2 leading-relaxed">{rec.description}</p>
            </div>

            <div className="pt-4 border-t border-paper-3 flex items-center justify-between">
              <span className="text-xs font-mono text-ink-3">Target: {rec.targetTopic}</span>
              <button
                onClick={() => applyRecommendation(rec.id)}
                disabled={rec.applied}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-sm bg-terracotta hover:bg-terracotta-hover text-paper-0 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {rec.applied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Applied to Plan</span>
                  </>
                ) : (
                  <>
                    <span>Apply Action</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
