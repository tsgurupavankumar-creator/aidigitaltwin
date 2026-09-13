'use client';

import { useAppStore } from '@/lib/store';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { Send, CheckCircle2 } from 'lucide-react';

export default function InterventionsPage() {
  const interventions = useAppStore((s) => s.interventions);
  const dispatchIntervention = useAppStore((s) => s.dispatchIntervention);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="space-y-2">
        <span className="font-mono text-xs text-plum uppercase tracking-widest font-medium">
          01 / AUTOMATED ACTION DISPATCHES
        </span>
        <h1 className="font-baskerville italic font-normal text-4xl text-ink-0">
          Faculty Interventions & Directives
        </h1>
        <p className="text-sm text-ink-2 font-dmsans">
          Review and dispatch personalized academic intervention plans to at-risk students.
        </p>
      </div>

      <HairlineRule variant="plum" />

      <div className="space-y-4">
        {interventions.map((inv) => (
          <div key={inv.id} className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
                  TYPE: {inv.type}
                </span>
                <h3 className="font-inter font-bold text-base text-ink-0">{inv.title}</h3>
                <p className="text-xs text-plum font-semibold">Student: {inv.studentName} (ID: {inv.studentId})</p>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                inv.status === 'DISPATCHED' ? 'bg-olive text-paper-0' : 'bg-mustard text-paper-0'
              }`}>
                {inv.status}
              </span>
            </div>

            <p className="text-xs text-ink-2 leading-relaxed">{inv.description}</p>

            <div className="p-3 rounded bg-paper-1 border border-paper-3 text-xs space-y-1">
              <span className="font-mono text-[10px] text-ink-3 font-semibold uppercase">SUGGESTED ACTION</span>
              <p className="font-semibold text-ink-0">{inv.suggestedAction}</p>
            </div>

            <div className="pt-2 border-t border-paper-3 flex justify-end">
              <button
                onClick={() => dispatchIntervention(inv.id)}
                disabled={inv.status === 'DISPATCHED'}
                className="px-4 py-1.5 text-xs font-semibold rounded-sm bg-plum text-paper-0 hover:bg-plum/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {inv.status === 'DISPATCHED' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Dispatched</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Dispatch Directive</span>
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
