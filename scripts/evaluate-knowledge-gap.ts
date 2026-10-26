/**
 * Evaluates the knowledge-gap agent on the app's REAL data (needs DATABASE_URL).
 *   npm run eval:knowledge-gap            (writes ml/reports/knowledge_gap_eval.json)
 * Needs knowledge-gap runs followed by quiz answers; reports "not enough data yet" otherwise.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { evaluateKnowledgeGaps } from '../src/lib/twin/knowledge-gap-eval';

async function main() {
  const prisma = new PrismaClient();
  try {
    const logs = await prisma.agentLog.findMany({ where: { agentType: 'CONCEPT_MASTERY', status: 'COMPLETED' }, select: { studentId: true, createdAt: true, output: true } });
    const runs = logs.filter((l): l is typeof l & { studentId: string } => !!l.studentId).map((l) => {
      const gaps = ((l.output as any)?.prediction?.criticalGaps ?? []) as Array<{ conceptId: string }>;
      return { studentId: l.studentId, at: l.createdAt, flaggedConceptIds: gaps.map((g) => g.conceptId) };
    });
    const responses = await prisma.quizResponse.findMany({
      select: { isCorrect: true, question: { select: { conceptId: true } }, attempt: { select: { studentId: true, createdAt: true } } },
    });
    const answers = responses.map((r) => ({ studentId: r.attempt.studentId, conceptId: r.question.conceptId, at: r.attempt.createdAt, isCorrect: r.isCorrect }));
    const result = evaluateKnowledgeGaps(runs, answers);
    const dir = join(process.cwd(), 'ml', 'reports');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'knowledge_gap_eval.json'), JSON.stringify({ generatedAt: new Date().toISOString(), runs: runs.length, ...result }, null, 2));
    console.log(result.verdict);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
