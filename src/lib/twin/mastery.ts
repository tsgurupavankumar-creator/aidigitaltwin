import type { Prisma, Trend } from '@prisma/client';

/**
 * How a new piece of evidence moves a student's mastery of one concept.
 *
 * observed   = the student's score on that concept in this assessment (0-100)
 * new score  = previous + weight x (observed - previous)
 * weight     = 1 for the first assessment, then 0.5, 0.4, ... down to a floor
 *              of 0.25, so early evidence counts a lot and a long history is
 *              not overturned by one result
 * trend      = UP / DOWN when the score moved by at least 2 points, else STABLE
 * confidence = grows with the number of assessments: 0.3 + 0.1 per assessment,
 *              capped at 0.95
 *
 * These are transparent, hand-set rules (documented as such), not a trained
 * knowledge-tracing model; OULAD has no item-level responses to fit one on.
 */
export const MASTERY_WEIGHT_FLOOR = 0.25;
export const TREND_THRESHOLD = 2;

export interface MasteryState {
  masteryScore: number;
  assessmentCount: number;
}

export interface MasteryUpdate {
  masteryScore: number;
  previousScore: number | null;
  trend: Trend;
  confidenceLevel: number;
  assessmentCount: number;
}

export function nextMastery(previous: MasteryState | null, observed: number): MasteryUpdate {
  const clamped = Math.max(0, Math.min(100, observed));
  if (!previous || previous.assessmentCount <= 0) {
    return { masteryScore: round(clamped), previousScore: previous ? previous.masteryScore : null, trend: 'STABLE', confidenceLevel: 0.4, assessmentCount: 1 };
  }
  const count = previous.assessmentCount + 1;
  const weight = Math.max(MASTERY_WEIGHT_FLOOR, 1 / count);
  const score = round(previous.masteryScore + weight * (clamped - previous.masteryScore));
  const delta = score - previous.masteryScore;
  const trend: Trend = delta >= TREND_THRESHOLD ? 'UP' : delta <= -TREND_THRESHOLD ? 'DOWN' : 'STABLE';
  return {
    masteryScore: score,
    previousScore: previous.masteryScore,
    trend,
    confidenceLevel: Math.min(0.95, round(0.3 + 0.1 * count, 2)),
    assessmentCount: count,
  };
}

/** Per-concept percentage from graded answers: { conceptId: % correct }. */
export function observedByConcept(answers: Array<{ conceptId: string; isCorrect: boolean }>): Record<string, number> {
  const tally = new Map<string, { correct: number; total: number }>();
  for (const a of answers) {
    const t = tally.get(a.conceptId) ?? { correct: 0, total: 0 };
    t.total += 1;
    if (a.isCorrect) t.correct += 1;
    tally.set(a.conceptId, t);
  }
  return Object.fromEntries([...tally].map(([id, t]) => [id, (100 * t.correct) / t.total]));
}

/** Applies observed per-concept scores for one student inside a transaction. */
export async function applyMastery(
  tx: Prisma.TransactionClient,
  studentId: string,
  observed: Record<string, number>
): Promise<number> {
  let updated = 0;
  for (const [conceptId, score] of Object.entries(observed)) {
    const existing = await tx.conceptMastery.findUnique({ where: { studentId_conceptId: { studentId, conceptId } } });
    const next = nextMastery(existing, score);
    await tx.conceptMastery.upsert({
      where: { studentId_conceptId: { studentId, conceptId } },
      create: { studentId, conceptId, ...next },
      update: next,
    });
    updated += 1;
  }
  return updated;
}

function round(value: number, digits = 1) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
