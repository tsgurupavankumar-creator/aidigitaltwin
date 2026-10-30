'use client';

import { useEffect, useState } from 'react';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { Brain, AlertTriangle, Loader2, RotateCcw, CheckCircle2 } from 'lucide-react';

interface FacultyConceptGap {
  id: string;
  concept: string;
  subject: string;
  courseCode: string;
  mastery: number;
  strugglingStudentsCount: number;
  totalAssessed: number;
  difficulty: number;
}

export default function FacultyKnowledgeGapsPage() {
  const [gaps, setGaps] = useState<FacultyConceptGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchKnowledgeGaps = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/faculty/knowledge-gaps');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load knowledge heatmap');
      setGaps(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load concept deficits');
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
        <span className="font-mono text-xs text-plum uppercase tracking-widest font-medium">
          01 / CLASS KNOWLEDGE GAPS
        </span>
        <h1 className="font-baskerville italic font-normal text-4xl page-title">
          Where your class is weakest
        </h1>
        <p className="text-sm text-ink-2 font-dmsans">
          Average mastery per concept across your students who have been assessed on it, weakest first.
        </p>
      </div>

      <HairlineRule variant="plum" />

      {loading ? (
        <div className="p-16 rounded-md bg-paper-0 border border-paper-3 flex flex-col items-center justify-center gap-3 text-ink-2">
          <Loader2 className="w-8 h-8 animate-spin text-plum" />
          <span className="font-mono text-xs uppercase tracking-wider">Aggregating cohort concept mastery...</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-md bg-burgundy/10 border border-burgundy/20 space-y-3">
          <p className="text-sm font-semibold text-burgundy">{error}</p>
          <button
            onClick={fetchKnowledgeGaps}
            className="px-3 py-1.5 text-xs font-mono rounded bg-plum text-paper-0 hover:bg-plum/90 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : gaps.length === 0 ? (
        <div className="p-16 rounded-md bg-paper-0 border border-paper-3 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-olive mx-auto" />
          <h3 className="font-semibold text-ink-0 text-sm">No Concept Deficits Identified</h3>
          <p className="text-xs text-ink-2">All concepts across your courses currently demonstrate strong class mastery.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {gaps.map((gap) => (
            <div key={gap.id} className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
                    {gap.courseCode} • {gap.subject}
                  </span>
                  <h3 className="font-inter font-bold text-base text-ink-0">{gap.concept}</h3>
                </div>
                <span className="font-space font-bold text-xl text-burgundy">{gap.mastery}% Avg</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-ink-2">
                  <span>Class Mastery Level</span>
                  <span className="font-mono font-semibold">
                    {gap.strugglingStudentsCount} of {gap.totalAssessed} student{gap.totalAssessed === 1 ? '' : 's'} below 70%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-paper-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      gap.mastery < 65 ? 'bg-burgundy' : gap.mastery < 75 ? 'bg-mustard' : 'bg-olive'
                    }`}
                    style={{ width: `${gap.mastery}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-paper-3 text-xs text-ink-2 flex items-center justify-between">
                <span>{gap.totalAssessed > 0 && gap.strugglingStudentsCount / gap.totalAssessed >= 0.5
                  ? `Half or more of the assessed students are below 70%: worth revisiting ${gap.concept} in class.`
                  : gap.strugglingStudentsCount > 0
                    ? `${gap.strugglingStudentsCount} student${gap.strugglingStudentsCount === 1 ? ' needs' : 's need'} targeted practice on ${gap.concept}.`
                    : `No assessed student is below 70% on ${gap.concept}.`}</span>
                <span className="font-mono text-[10px] text-ink-3">Difficulty {gap.difficulty} / 5</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
