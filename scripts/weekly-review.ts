/**
 * Scheduled weekly review: runs every agent for every student who has a
 * digital twin, then recomputes the class insights of their courses.
 *
 *   npm run twin:weekly-review
 *
 * Needs DATABASE_URL and the ML service (ML_SERVICE_URL). Schedule it, e.g.
 * every Monday 06:00 with cron:
 *   0 6 * * 1  cd /path/to/aidigitaltwin-updated && npm run twin:weekly-review >> weekly-review.log 2>&1
 *
 * Exits with status 1 if any student's review failed or was degraded, so a
 * scheduler can alert on it. A second run in the same hour is replayed (no
 * duplicate alerts), by the orchestrator's duplicate guard.
 */
import { prisma } from '../src/lib/prisma';
import { runTwinSync } from '../src/lib/twin/sync';

async function main() {
  const students = await prisma.digitalTwin.findMany({ select: { studentId: true } });
  console.log(`Weekly review for ${students.length} students...`);
  const report = await runTwinSync(students.map((s) => ({ studentId: s.studentId, event: 'weekly_review' as const })));
  const counts = report.students.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  console.log('Result:', JSON.stringify(counts), `| class insights refreshed: ${report.insightsRefreshed}`);
  for (const r of report.students.filter((x) => x.status === 'failed' || x.status === 'degraded')) {
    console.log(`  ${r.status.padEnd(8)} ${r.studentId}${r.detail ? `  ${r.detail}` : ''}`);
  }
  await prisma.$disconnect();
  if ((counts.failed ?? 0) + (counts.degraded ?? 0) > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
