'use client';

import { useAppStore } from '@/lib/store';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { CheckCircle2, Clock, Plus, Trash2 } from 'lucide-react';

export default function StudyPlanPage() {
  const tasks = useAppStore((s) => s.tasks);
  const toggleTaskCompleted = useAppStore((s) => s.toggleTaskCompleted);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="space-y-2">
        <span className="font-mono text-xs text-olive uppercase tracking-widest font-medium">
          01 / AI GENERATED SCHEDULE
        </span>
        <h1 className="font-fraunces italic font-normal text-4xl text-ink-0">
          Personalized Daily Study Plan
        </h1>
        <p className="text-sm text-ink-2 font-inter">
          Dynamically ordered focus blocks based on your cognitive twin's highest priority knowledge gaps.
        </p>
      </div>

      <HairlineRule variant="olive" />

      <div className="bg-paper-0 border border-paper-3 rounded-md divide-y divide-paper-3">
        {tasks.map((task) => (
          <div key={task.id} className="p-5 flex items-center justify-between hover:bg-paper-1 transition-colors">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => toggleTaskCompleted(task.id)}
                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                  task.completed ? 'bg-olive border-olive text-paper-0' : 'border-paper-3 hover:border-ink-2'
                }`}
              >
                {task.completed && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
              </button>
              <div className="space-y-1">
                <span className={`text-sm font-semibold text-ink-0 ${task.completed ? 'line-through opacity-50' : ''}`}>
                  {task.title}
                </span>
                <div className="flex items-center gap-3 text-xs text-ink-3 font-mono">
                  <span>Priority: {task.priority}</span>
                  <span>•</span>
                  <span>{task.dueDate}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs text-ink-2">
              <Clock className="w-3.5 h-3.5 text-ink-3" />
              <span>{task.estimatedTime || 20}m</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
