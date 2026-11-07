/**
 * Does the knowledge-gap agent find real weaknesses? For every quiz answer, take the
 * student's latest knowledge-gap run BEFORE the answer (within a horizon); the answer's
 * concept is "flagged" if that run listed it as a gap. A useful agent means flagged
 * concepts are answered wrongly more often than unflagged ones.
 */
export interface GapRun { studentId: string; at: Date; flaggedConceptIds: string[] }
export interface Answer { studentId: string; conceptId: string; at: Date; isCorrect: boolean }

export interface GapEvaluation {
  answersEvaluated: number;
  flagged: { answers: number; errorRate: number | null };
  notFlagged: { answers: number; errorRate: number | null };
  /** errorRate(flagged) / errorRate(notFlagged); > 1 means the flags point at real weaknesses. */
  riskRatio: number | null;
  /** Two-proportion z-test on the error rates; |z| > 1.96 is significant at 5%. */
  zScore: number | null;
  verdict: string;
  horizonDays: number;
}

export function evaluateKnowledgeGaps(runs: GapRun[], answers: Answer[], horizonDays = 30): GapEvaluation {
  const byStudent = new Map<string, GapRun[]>();
  for (const r of runs) byStudent.set(r.studentId, [...(byStudent.get(r.studentId) ?? []), r]);
  for (const list of byStudent.values()) list.sort((a, b) => a.at.getTime() - b.at.getTime());
  const horizon = horizonDays * 86_400_000;
  const tally = { f: { n: 0, wrong: 0 }, u: { n: 0, wrong: 0 } };
  for (const a of answers) {
    const list = byStudent.get(a.studentId);
    if (!list) continue;
    let run: GapRun | undefined;
    for (const r of list) { if (r.at < a.at) run = r; else break; }
    if (!run || a.at.getTime() - run.at.getTime() > horizon) continue;
    const bucket = run.flaggedConceptIds.includes(a.conceptId) ? tally.f : tally.u;
    bucket.n += 1;
    if (!a.isCorrect) bucket.wrong += 1;
  }
  const rate = (b: { n: number; wrong: number }) => (b.n ? b.wrong / b.n : null);
  const rf = rate(tally.f), ru = rate(tally.u);
  let z: number | null = null;
  if (tally.f.n && tally.u.n) {
    const p = (tally.f.wrong + tally.u.wrong) / (tally.f.n + tally.u.n);
    const se = Math.sqrt(p * (1 - p) * (1 / tally.f.n + 1 / tally.u.n));
    z = se ? (rf! - ru!) / se : null;
  }
  const ratio = rf !== null && ru ? rf / ru : null;
  const total = tally.f.n + tally.u.n;
  const verdict = total < 50 || !tally.f.n || !tally.u.n
    ? `not enough data yet (${total} answers after a knowledge-gap run; need at least 50, with both flagged and unflagged concepts)`
    : z !== null && z > 1.96
      ? `useful: flagged concepts were answered wrongly ${ratio!.toFixed(2)}x as often (significant, z = ${z.toFixed(2)})`
      : `not shown to be useful: flagged vs unflagged error rates ${(100 * rf!).toFixed(0)}% vs ${(100 * ru!).toFixed(0)}% (z = ${z?.toFixed(2)})`;
  return {
    answersEvaluated: total,
    flagged: { answers: tally.f.n, errorRate: rf },
    notFlagged: { answers: tally.u.n, errorRate: ru },
    riskRatio: ratio,
    zScore: z,
    verdict,
    horizonDays,
  };
}
