import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRiskAssessment, examScoreToGpa, levelForScore } from '../src/lib/agents/risk-scoring';
import type { AttendancePrediction, KnowledgeGapPrediction, LearningPrediction } from '../src/lib/agents/types';

const att = (riskScore: number, currentAttendance = 80): AttendancePrediction => ({
  modelUsed: 'trained', atRisk: riskScore > 0.5, riskScore, currentAttendance,
  projectedAttendance: currentAttendance, daysUntilCritical: 30, confidence: 0.8,
});
const gap = (overallGapScore: number): KnowledgeGapPrediction => ({ criticalGaps: [], overallGapScore, confidence: 0.7 });
const learn = (trend: 'UP' | 'DOWN' | 'STABLE', nextExamScore = 70): LearningPrediction => ({
  nextExamScore, modelUsed: 'trained', trend, confidence: 0.6, topWeakConcepts: [], topStrongConcepts: [],
});
const twin = { attendanceScore: 90, knowledgeScore: 60 };

// The formula exactly as it was in orchestrator.ts before this change.
function originalScore(attRisk: number, gapScore: number, trend: 'UP' | 'DOWN' | 'STABLE'): number {
  const gapRisk = gapScore / 100;
  const learnRisk = trend === 'DOWN' ? 0.7 : trend === 'STABLE' ? 0.35 : 0.15;
  return Math.max(0, Math.min(100, Math.round((attRisk * 0.4 + gapRisk * 0.35 + learnRisk * 0.25) * 100)));
}

test('REGRESSION: with all three agents present the score is identical to the original formula', () => {
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const trends = ['UP', 'DOWN', 'STABLE'] as const;
  for (let i = 0; i < 2000; i++) {
    const a = rnd(), g = rnd() * 100, t = trends[Math.floor(rnd() * 3)];
    const out = computeRiskAssessment({ attendance: att(a), knowledge: gap(g), learning: learn(t), twin, confidences: [0.5] });
    assert.equal(out.riskScore, originalScore(a, g, t), `mismatch for att=${a} gap=${g} trend=${t}`);
  }
});

test('risk level cutoffs are unchanged (25 / 45 / 70)', () => {
  assert.deepEqual([24, 25, 44, 45, 69, 70, 100].map((score) => levelForScore(score)),
    ['LOW', 'MEDIUM', 'MEDIUM', 'HIGH', 'HIGH', 'CRITICAL', 'CRITICAL']);
});

test('no learning result: component excluded and weights renormalized, no invented 0.15, GPA is null', () => {
  const out = computeRiskAssessment({ attendance: att(1), knowledge: gap(100), twin, confidences: [0.8, 0.7] });
  assert.equal(out.riskScore, 100);                 // (0.4*1 + 0.35*1) / 0.75 = 1.0   (old default would give 79)
  assert.equal(out.predictedGPA, null);
  assert.equal(out.factors.learningRisk, null);
  assert.equal(out.factors.predictedExamScore, null);
  assert.equal(out.factors.signalSources.learning, 'unavailable');
});

test('attendance agent absent: uses the stored twin score and says so', () => {
  const out = computeRiskAssessment({ knowledge: gap(0), learning: learn('UP'), twin: { attendanceScore: 90, knowledgeScore: 60 }, confidences: [0.7] });
  assert.ok(Math.abs(out.factors.attendanceRisk - 0.1) < 1e-9);
  assert.equal(out.factors.currentAttendance, 90);
  assert.equal(out.factors.signalSources.attendance, 'twin');
});

test('knowledge agent absent: uses the stored twin score, and knowledgeGapScore is null (was 35)', () => {
  const out = computeRiskAssessment({ attendance: att(0), learning: learn('UP'), twin: { attendanceScore: 90, knowledgeScore: 60 }, confidences: [0.7] });
  assert.ok(Math.abs(out.factors.knowledgeRisk - 0.4) < 1e-9);
  assert.equal(out.factors.knowledgeGapScore, null);
  assert.equal(out.factors.signalSources.knowledge, 'twin');
});

test('confidence is the real mean of agent confidences, and there is no 0.85 fallback', () => {
  const out = computeRiskAssessment({ attendance: att(0.2), knowledge: gap(10), learning: learn('UP'), twin, confidences: [0.5, 0.7, 0.9] });
  assert.equal(out.confidenceScore, 0.7);
  assert.throws(() => computeRiskAssessment({ attendance: att(0.2), twin, confidences: [] }), /at least one agent result/);
});

test('exam score → GPA: clamped, and a score of 0 still yields a GPA (old code treated 0 as "missing")', () => {
  assert.equal(examScoreToGpa(100), 10);
  assert.equal(examScoreToGpa(75), 7.5);
  assert.equal(examScoreToGpa(10), 1, 'no invented floor');
  const out = computeRiskAssessment({ attendance: att(0.5), learning: learn('DOWN', 0), twin, confidences: [0.5] });
  assert.equal(out.predictedGPA, 0, 'a predicted 0 is a real 0 (10-point scale)');
});

test('non-finite stored twin values never produce NaN', () => {
  const out = computeRiskAssessment({ learning: learn('STABLE'), twin: { attendanceScore: NaN, knowledgeScore: Infinity }, confidences: [0.5] });
  assert.ok(Number.isFinite(out.riskScore));
  assert.ok(out.riskScore >= 0 && out.riskScore <= 100);
});
