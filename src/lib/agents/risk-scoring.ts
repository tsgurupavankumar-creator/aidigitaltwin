/**
 * Composite risk scoring for the orchestrator.
 *
 * Pure functions only (no database, no Prisma imports) so the logic can be
 * unit-tested in isolation — see tests/risk-scoring.test.ts.
 *
 * HONESTY RULES this module enforces (they replace values that used to be
 * invented and written to the database):
 *   - A component with no real input is EXCLUDED and the remaining weights are
 *     renormalized. It is never replaced by a made-up constant.
 *   - When an agent did not run this cycle, its component falls back to the
 *     digital twin's STORED score (real data written by an earlier run), and
 *     `factors.signalSources` records that the value came from the twin and not
 *     from a fresh agent run.
 *   - `predictedGPA` is null when there is no learning prediction (was 3.65).
 *   - `confidenceScore` is the mean of the real agent confidences. With no
 *     agent results there is nothing to average, so this throws (was 0.85).
 *
 * Two sets of numbers:
 *   - HAND-SET defaults below (weights 0.4 / 0.35 / 0.25, trend -> risk, level
 *     cut-offs 25 / 45 / 70). Not validated.
 *   - DATA-DRIVEN, when ml/models/risk_config.json exists (written by
 *     ml/calibrate_risk_score.py): the learning risk comes from the predicted
 *     mark via a map learned on OULAD, the attendance/learning weighting is
 *     learned, and the level cut-offs are set so that LOW/MEDIUM/HIGH/CRITICAL
 *     match observed fail-or-withdraw rates of <25%, 25-50%, 50-75%, >75% on
 *     unseen presentations. The knowledge weight stays hand-set (OULAD has no
 *     concept data to test it). `factors.configSource` records which was used.
 */
import type { AttendancePrediction, KnowledgeGapPrediction, LearningPrediction } from './types';

export type RiskLevelName = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SignalSource = 'agent' | 'twin' | 'unavailable';

export const RISK_WEIGHTS = { attendance: 0.4, knowledge: 0.35, learning: 0.25 } as const;
export const TREND_RISK = { DOWN: 0.7, STABLE: 0.35, UP: 0.15 } as const;

export interface RiskConfig {
  weights: { attendance: number; knowledge: number; learning: number };
  /** Predicted mark (x, ascending) -> risk 0..1 (y); interpolated linearly, clamped at the ends. */
  learningRiskMap?: { x: number[]; y: number[] };
  levelCutoffs: { MEDIUM: number; HIGH: number; CRITICAL: number };
  /** When ml/calibrate_risk_score.py produced it (data-driven configs only). */
  generatedAt?: string;
}

export const HAND_SET_CONFIG: RiskConfig = {
  weights: { ...RISK_WEIGHTS },
  levelCutoffs: { MEDIUM: 25, HIGH: 45, CRITICAL: 70 },
};

/** Piecewise-linear lookup, clamped to the end values. */
export function interpolate(map: { x: number[]; y: number[] }, value: number): number {
  const { x, y } = map;
  if (!x.length) return NaN;
  if (value <= x[0]) return y[0];
  if (value >= x[x.length - 1]) return y[y.length - 1];
  let i = 1;
  while (x[i] < value) i += 1;
  const t = (value - x[i - 1]) / (x[i] - x[i - 1] || 1);
  return y[i - 1] + t * (y[i] - y[i - 1]);
}

export interface TwinSignals {
  /** Stored 0–100 attendance score from the DigitalTwin row. */
  attendanceScore: number;
  /** Stored 0–100 knowledge score (the orchestrator writes it as 100 - overallGapScore). */
  knowledgeScore: number;
}

export interface RiskAssessmentInput {
  attendance?: AttendancePrediction;
  knowledge?: KnowledgeGapPrediction;
  learning?: LearningPrediction;
  twin: TwinSignals;
  /** Confidence values of the agent results that actually ran. */
  confidences: number[];
  /** Data-driven settings (risk_config.json); hand-set defaults when absent. */
  config?: RiskConfig | null;
}

export interface RiskAssessmentOutput {
  riskScore: number;
  riskLevel: RiskLevelName;
  /** Null when no learning prediction exists. */
  predictedGPA: number | null;
  confidenceScore: number;
  factors: {
    attendanceRisk: number;
    knowledgeRisk: number;
    learningRisk: number | null;
    currentAttendance: number;
    knowledgeGapScore: number | null;
    predictedExamScore: number | null;
    signalSources: { attendance: SignalSource; knowledge: SignalSource; learning: SignalSource };
    configSource: 'data' | 'hand-set';
  };
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function levelForScore(score: number, cutoffs: RiskConfig['levelCutoffs'] = HAND_SET_CONFIG.levelCutoffs): RiskLevelName {
  if (score >= cutoffs.CRITICAL) return 'CRITICAL';
  if (score >= cutoffs.HIGH) return 'HIGH';
  if (score >= cutoffs.MEDIUM) return 'MEDIUM';
  return 'LOW';
}

/**
 * Rough linear exam-score → 4.0-scale conversion (clamped to 2.0–4.0). This is
 * a display heuristic, not a model output.
 */
export function examScoreToGpa(examScore: number): number {
  return Math.max(2.0, Math.min(4.0, Number(((examScore / 100) * 4).toFixed(2))));
}

export function computeRiskAssessment(input: RiskAssessmentInput): RiskAssessmentOutput {
  if (input.confidences.length === 0) {
    throw new Error('Cannot compute a risk assessment without at least one agent result.');
  }

  const attendanceRisk = input.attendance
    ? input.attendance.riskScore
    : clamp01(1 - input.twin.attendanceScore / 100);
  const knowledgeRisk = input.knowledge
    ? input.knowledge.overallGapScore / 100
    : clamp01(1 - input.twin.knowledgeScore / 100);
  const config = input.config ?? HAND_SET_CONFIG;
  const fromData = !!input.config;
  const learningRisk = !input.learning
    ? null
    : config.learningRiskMap
      ? clamp01(interpolate(config.learningRiskMap, input.learning.nextExamScore))
      : TREND_RISK[input.learning.trend];

  const parts: Array<{ weight: number; risk: number }> = [
    { weight: config.weights.attendance, risk: attendanceRisk },
    { weight: config.weights.knowledge, risk: knowledgeRisk },
  ];
  if (learningRisk !== null) parts.push({ weight: config.weights.learning, risk: learningRisk });

  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  const weighted = parts.reduce((sum, part) => sum + part.weight * part.risk, 0) / totalWeight;
  const riskScore = Math.max(0, Math.min(100, Math.round(weighted * 100)));

  const confidenceScore = Number(
    (input.confidences.reduce((sum, value) => sum + value, 0) / input.confidences.length).toFixed(2)
  );

  return {
    riskScore,
    riskLevel: levelForScore(riskScore, config.levelCutoffs),
    predictedGPA: input.learning ? examScoreToGpa(input.learning.nextExamScore) : null,
    confidenceScore,
    factors: {
      attendanceRisk,
      knowledgeRisk,
      learningRisk,
      currentAttendance: input.attendance?.currentAttendance ?? input.twin.attendanceScore,
      knowledgeGapScore: input.knowledge?.overallGapScore ?? null,
      predictedExamScore: input.learning?.nextExamScore ?? null,
      signalSources: {
        attendance: input.attendance ? 'agent' : 'twin',
        knowledge: input.knowledge ? 'agent' : 'twin',
        learning: input.learning ? 'agent' : 'unavailable',
      },
      configSource: fromData ? 'data' : 'hand-set',
    },
  };
}
