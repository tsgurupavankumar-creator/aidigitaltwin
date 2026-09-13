'use client';

import { useAppStore } from '@/lib/store';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function KnowledgeGapsPage() {
  const knowledgeGaps = useAppStore((s) => s.knowledgeGaps);

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

      {/* Knowledge Gaps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {knowledgeGaps.map((gap) => (
          <div key={gap.id} className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
                  {gap.subject || 'COMPUTER SCIENCE'}
                </span>
                <h3 className="font-inter font-bold text-base text-ink-0 tracking-tight">{gap.concept}</h3>
              </div>
              <span className="font-space font-bold text-xl text-burgundy">{gap.mastery}%</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-ink-2">
                <span>Concept Mastery Progress</span>
                <span className="font-mono">{gap.mastery} / 100</span>
              </div>
              <div className="w-full h-1.5 bg-paper-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-mustard rounded-full"
                  style={{ width: `${gap.mastery}%` }}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-paper-3 flex items-center justify-between text-xs">
              <span className="text-ink-3 font-mono">Previous: {gap.previousMastery}%</span>
              <button className="text-terracotta hover:underline font-semibold flex items-center gap-1">
                <span>Launch Remediation Drill</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
