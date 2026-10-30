/**
 * Study-plan rules:
 *  - a task's priority and length follow how far the concept's mastery is below the 70% target
 *  - tasks are spread over the next 7 days: each new task goes to the least busy day
 */
export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export function taskFor(mastery: number | null): { priority: TaskPriority; estimatedMins: number } {
  if (mastery === null) return { priority: 'MEDIUM', estimatedMins: 30 };   // not assessed yet: a first look
  const gap = Math.max(0, 70 - mastery);
  const priority: TaskPriority = gap >= 30 ? 'HIGH' : gap >= 10 ? 'MEDIUM' : 'LOW';
  return { priority, estimatedMins: Math.min(90, 20 + Math.round(gap * 1.5)) };
}

const DAY = 86_400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Picks the day (from tomorrow, next 7 days) with the fewest planned minutes; earliest on ties. */
export function scheduleDay(existing: Array<{ scheduledFor: Date | null; estimatedMins: number; completed: boolean }>, now = new Date()): Date {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + DAY);
  const load = new Map<string, number>();
  for (const t of existing) if (t.scheduledFor && !t.completed) load.set(dayKey(t.scheduledFor), (load.get(dayKey(t.scheduledFor)) ?? 0) + t.estimatedMins);
  let best = start, bestLoad = Infinity;
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + i * DAY);
    const l = load.get(dayKey(d)) ?? 0;
    if (l < bestLoad) { best = d; bestLoad = l; }
  }
  return best;
}
