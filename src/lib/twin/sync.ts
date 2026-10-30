import { createHash } from 'crypto';
import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { orchestrate } from '@/lib/agents/orchestrator';
import type { OrchestrationResult, StudentEvent } from '@/lib/agents/types';
import { refreshCourseInsight } from './class-insights';

/**
 * Keeps the digital twin in step with the data. Every write that changes a
 * student's record (attendance, a quiz attempt, a grade, a submission) calls
 * scheduleTwinSync(); the student's agents run, the twin, risk, alerts and
 * recommendations update, and the class insights of the student's courses are
 * recomputed. The scheduled weekly review (scripts/weekly-review.ts) uses
 * runTwinSync() directly.
 */

export interface SyncTask {
  studentId: string;
  event: StudentEvent;
  /** The change that triggered it, e.g. `attendance:<id>:<updatedAt>`. Omit for scheduled reviews. */
  sourceKey?: string;
}

export type SyncStatus = 'updated' | 'replayed' | 'degraded' | 'failed';

export interface SyncReport {
  students: Array<{ studentId: string; event: StudentEvent; status: SyncStatus; detail?: string }>;
  insightsRefreshed: number;
}

export interface SyncDeps {
  orchestrate: (studentId: string, event: StudentEvent, options: { sourceKey?: string; skipCourseInsightRefresh?: boolean }) => Promise<OrchestrationResult>;
  coursesOf: (studentIds: string[]) => Promise<string[]>;
  refreshInsight: (courseId: string) => Promise<unknown>;
}

const defaultDeps: SyncDeps = {
  orchestrate,
  coursesOf: async (studentIds) => {
    const rows = await prisma.enrollment.findMany({ where: { studentId: { in: studentIds } }, select: { courseId: true }, distinct: ['courseId'] });
    return rows.map((r) => r.courseId);
  },
  refreshInsight: (courseId) => refreshCourseInsight(prisma, courseId),
};

/** One run per student and event; several changes in one batch share one combined key. */
export function mergeTasks(tasks: SyncTask[]): SyncTask[] {
  const groups = new Map<string, SyncTask[]>();
  for (const task of tasks) {
    const key = `${task.studentId}|${task.event}`;
    groups.set(key, [...(groups.get(key) ?? []), task]);
  }
  return [...groups.values()].map((group) => {
    const keys = group.map((t) => t.sourceKey).filter((k): k is string => !!k).sort();
    const sourceKey = keys.length === 0 ? undefined : keys.length === 1 ? keys[0] : `batch:${createHash('sha256').update(keys.join('\n')).digest('hex').slice(0, 32)}`;
    return { studentId: group[0].studentId, event: group[0].event, sourceKey };
  });
}

export async function runTwinSync(tasks: SyncTask[], deps: SyncDeps = defaultDeps, concurrency = 4): Promise<SyncReport> {
  const merged = mergeTasks(tasks);
  const results: SyncReport['students'] = [];
  let next = 0;
  async function worker() {
    while (next < merged.length) {
      const task = merged[next++];
      try {
        const outcome = await deps.orchestrate(task.studentId, task.event, {
          sourceKey: task.sourceKey,
          skipCourseInsightRefresh: true,
        });
        const status: SyncStatus = outcome.replayed ? 'replayed' : outcome.degraded ? 'degraded' : 'updated';
        results.push({
          studentId: task.studentId,
          event: task.event,
          status,
          detail: outcome.degraded ? outcome.agentErrors?.map((e) => `${e.agent}: ${e.message}`).join('; ') : undefined,
        });
      } catch (error) {
        results.push({ studentId: task.studentId, event: task.event, status: 'failed', detail: (error as Error).message });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, merged.length) }, worker));

  let insightsRefreshed = 0;
  const studentIds = [...new Set(merged.map((t) => t.studentId))];
  if (studentIds.length) {
    for (const courseId of await deps.coursesOf(studentIds)) {
      try {
        await deps.refreshInsight(courseId);
        insightsRefreshed += 1;
      } catch (error) {
        console.error('[TWIN_SYNC] class insight refresh failed for course', courseId, (error as Error).message);
      }
    }
  }
  for (const r of results) {
    if (r.status === 'degraded' || r.status === 'failed') {
      console.warn(`[TWIN_SYNC] ${r.event} for student ${r.studentId}: ${r.status}${r.detail ? ` (${r.detail})` : ''}`);
    }
  }
  return { students: results, insightsRefreshed };
}

/**
 * Runs the sync after the HTTP response has been sent (Next.js `after`), so a
 * faculty member saving a whole class's attendance is not kept waiting on
 * every agent run. Outside a request (scripts, tests) it runs in the
 * background. Returns how many student runs were queued.
 */
export function scheduleTwinSync(tasks: SyncTask[]): number {
  const merged = mergeTasks(tasks);
  if (!merged.length) return 0;
  const job = () => runTwinSync(merged).then(() => undefined).catch((error) => {
    console.error('[TWIN_SYNC] failed:', (error as Error).message);
  });
  try {
    after(job);
  } catch {
    void job();
  }
  return merged.length;
}
