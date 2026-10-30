'use client';

import { useEffect, useState } from 'react';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { Send, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';

interface InterventionRow {
  id: string;
  studentId: string;
  type: 'TUTORING' | 'COUNSELING' | 'QUIZ' | 'MEETING';
  notes: string;
  outcome?: string | null;
  scheduledAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  student: { id: string; fullName: string };
}

export default function InterventionsPage() {
  const [interventions, setInterventions] = useState<InterventionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/faculty/intervention', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load interventions');
      setInterventions(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load interventions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const updateIntervention = async (id: string, action: 'DISPATCH' | 'COMPLETE') => {
    setUpdating(id);
    setError('');
    try {
      const res = await fetch('/api/faculty/intervention', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interventionId: id, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed to ${action.toLowerCase()} intervention`);
      setInterventions((current) => current.map((item) => item.id === id ? { ...item, scheduledAt: json.data.scheduledAt, completedAt: json.data.completedAt } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to dispatch intervention');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="space-y-2">
        <span className="font-mono text-xs text-plum uppercase tracking-widest font-medium">01 / INTERVENTIONS</span>
        <h1 className="font-baskerville italic font-normal text-4xl text-ink-0">Faculty Interventions & Directives</h1>
        <p className="text-sm text-ink-2 font-dmsans">Interventions the system suggested for students at high risk. Review each one and record when it is done.</p>
      </div>
      <HairlineRule variant="plum" />

      {loading ? (
        <div className="p-12 rounded-md bg-paper-0 border border-paper-3 flex items-center justify-center gap-3 text-ink-2">
          <Loader2 className="w-5 h-5 animate-spin text-plum" /> Loading live intervention queue…
        </div>
      ) : error && interventions.length === 0 ? (
        <div className="p-6 rounded-md bg-burgundy/10 border border-burgundy/20 space-y-3">
          <p className="text-sm font-semibold text-burgundy">{error}</p>
          <button type="button" onClick={() => void load()} className="px-3 py-1.5 text-xs font-mono rounded bg-plum text-paper-0 flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : interventions.length === 0 ? (
        <div className="p-12 rounded-md bg-paper-0 border border-paper-3 text-center text-sm text-ink-2">
          No interventions are waiting for faculty action.
        </div>
      ) : (
        <div className="space-y-4">
          {error && <div className="p-3 rounded bg-burgundy/10 border border-burgundy/20 text-xs text-burgundy">{error}</div>}
          {interventions.map((inv) => {
            const dispatched = Boolean(inv.scheduledAt || inv.completedAt);
            const completed = Boolean(inv.completedAt);
            return (
              <div key={inv.id} className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">TYPE: {inv.type}</span>
                    <h3 className="font-inter font-bold text-base text-ink-0">{inv.type} intervention</h3>
                    <p className="text-xs text-plum font-semibold">Student: {inv.student.fullName} (ID: {inv.studentId})</p>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${dispatched ? 'bg-olive text-paper-0' : 'bg-mustard text-paper-0'}`}>
                    {completed ? 'COMPLETED' : inv.scheduledAt ? 'SCHEDULED' : 'PENDING'}
                  </span>
                </div>
                <p className="text-xs text-ink-2 leading-relaxed">{inv.notes}</p>
                <div className="pt-2 border-t border-paper-3 flex justify-end">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void updateIntervention(inv.id, 'DISPATCH')} disabled={dispatched || updating === inv.id} className="px-4 py-1.5 text-xs font-semibold rounded-sm bg-plum text-paper-0 flex items-center gap-1.5 disabled:opacity-50">
                      {inv.scheduledAt ? <><CheckCircle2 className="w-3.5 h-3.5" /> Scheduled</> : <><Send className="w-3.5 h-3.5" /> {updating === inv.id ? 'Updating…' : 'Dispatch'}</>}
                    </button>
                    <button type="button" onClick={() => void updateIntervention(inv.id, 'COMPLETE')} disabled={completed || updating === inv.id} className="px-4 py-1.5 text-xs font-semibold rounded-sm border border-olive text-olive flex items-center gap-1.5 disabled:opacity-50">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {completed ? 'Completed' : updating === inv.id ? 'Updating…' : 'Mark complete'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
