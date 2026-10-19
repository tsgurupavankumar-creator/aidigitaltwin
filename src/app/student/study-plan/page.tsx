'use client';

import { useEffect, useState } from 'react';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { CheckCircle2, Clock, Loader2, RotateCcw, BookOpen } from 'lucide-react';

interface StudyTaskItem {
  id: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedMins: number;
  completed: boolean;
  concept?: {
    id: string;
    name: string;
    difficulty: number;
  };
}

interface StudyPlanResponse {
  id: string;
  title: string;
  tasks: StudyTaskItem[];
}

export default function StudyPlanPage() {
  const [plan, setPlan] = useState<StudyPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchStudyPlan = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/student/study-plan');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load study plan');
      setPlan(json.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load study plan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudyPlan();
  }, []);

  const toggleTask = async (taskId: string, currentStatus: boolean) => {
    setTogglingId(taskId);
    try {
      const res = await fetch('/api/student/study-plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, completed: !currentStatus }),
      });
      if (res.ok) {
        setPlan((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === taskId ? { ...t, completed: !currentStatus } : t
            ),
          };
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingId(null);
    }
  };

  const tasks = plan?.tasks || [];
  const isAiGeneratedPlan = plan?.title.startsWith('AI Tutor Plan:') ?? false;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="space-y-2">
        <span className="font-mono text-xs text-olive uppercase tracking-widest font-medium">
          01 / AI GENERATED SCHEDULE
        </span>
        <h1 className="font-fraunces italic font-normal text-4xl text-ink-0">
          {plan?.title || 'Personalized Daily Study Plan'}
        </h1>
        <p className="text-sm text-ink-2 font-inter">
          Dynamically ordered focus blocks based on your cognitive twin's highest priority knowledge gaps.
        </p>
      </div>

      <HairlineRule variant="olive" />

      {loading ? (
        <div className="p-12 rounded-md bg-paper-0 border border-paper-3 flex flex-col items-center justify-center gap-3 text-ink-2">
          <Loader2 className="w-6 h-6 animate-spin text-olive" />
          <span className="font-mono text-xs uppercase tracking-wider">Generating dynamic schedule...</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-md bg-burgundy/10 border border-burgundy/20 space-y-3">
          <p className="text-sm font-semibold text-burgundy">{error}</p>
          <button
            onClick={fetchStudyPlan}
            className="px-3 py-1.5 text-xs font-mono rounded bg-olive text-paper-0 hover:bg-olive/90 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="p-12 rounded-md bg-paper-0 border border-paper-3 text-center space-y-2">
          <BookOpen className="w-8 h-8 text-olive mx-auto" />
          <h3 className="font-semibold text-ink-0 text-sm">No Study Tasks Scheduled</h3>
          <p className="text-xs text-ink-2">Apply recommendations or run an assessment to schedule personalized study tasks.</p>
        </div>
      ) : (
        <div className="bg-paper-0 border border-paper-3 rounded-md divide-y divide-paper-3">
          {tasks.map((task) => {
            const isToggling = togglingId === task.id;
            return (
              <div
                key={task.id}
                className="p-5 flex items-center justify-between hover:bg-paper-1 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    disabled={isToggling}
                    onClick={() => toggleTask(task.id, task.completed)}
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      task.completed
                        ? 'bg-olive border-olive text-paper-0'
                        : 'border-paper-3 hover:border-ink-2'
                    }`}
                  >
                    {isToggling ? (
                      <Loader2 className="w-3 h-3 animate-spin text-ink-3" />
                    ) : task.completed ? (
                      <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                    ) : null}
                  </button>
                  <div className="space-y-1">
                    <span
                      className={`text-sm font-semibold text-ink-0 ${
                        task.completed ? 'line-through opacity-50' : ''
                      }`}
                    >
                      {task.concept?.name ? `Mastery Block: ${task.concept.name}` : 'Core Concept Review Block'}
                    </span>
                    {isAiGeneratedPlan && (
                      <span className="ml-2 inline-flex rounded-full border border-plum/25 bg-plum-light px-2 py-0.5 align-middle font-mono text-[9px] font-semibold uppercase tracking-wide text-plum">
                        AI Generated
                      </span>
                    )}
                    <div className="flex items-center gap-3 text-xs text-ink-3 font-mono">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${
                        task.priority === 'HIGH'
                          ? 'bg-burgundy/10 text-burgundy'
                          : task.priority === 'MEDIUM'
                            ? 'bg-mustard/15 text-ink-1'
                            : 'bg-olive/10 text-olive'
                      }`}>
                        {task.priority} PRIORITY
                      </span>
                      <span>•</span>
                      <span>Difficulty: Level {task.concept?.difficulty || 3}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs text-ink-2">
                  <Clock className="w-3.5 h-3.5 text-ink-3" />
                  <span>{task.estimatedMins || 30}m</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
