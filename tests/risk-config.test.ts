import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { computeRiskAssessment, interpolate, levelForScore, type RiskConfig } from '../src/lib/agents/risk-scoring';
import { loadRiskConfig, parseRiskConfig } from '../src/lib/agents/risk-config';

const CONFIG: RiskConfig = {
  weights: { attendance: 0.3, learning: 0.35, knowledge: 0.35 },
  learningRiskMap: { x: [20, 50, 80], y: [0.9, 0.5, 0.1] },
  levelCutoffs: { MEDIUM: 30, HIGH: 50, CRITICAL: 75 },
};
const base = {
  twin: { attendanceScore: 80, knowledgeScore: 70 },
  confidences: [0.8],
  attendance: { modelUsed: 'trained', atRisk: false, riskScore: 0.3, currentAttendance: 80, projectedAttendance: 80, daysUntilCritical: 30, confidence: 0.8 },
  knowledge: { overallGapScore: 30 } as never,
} as const;
const learning = (score: number) => ({ nextExamScore: score, modelUsed: 'trained', trend: 'STABLE', confidence: 0.7, topWeakConcepts: [], topStrongConcepts: [] }) as never;

test('interpolate: linear between points, clamped at the ends', () => {
  const m = { x: [20, 50, 80], y: [0.9, 0.5, 0.1] };
  assert.equal(interpolate(m, 35), 0.7);
  assert.equal(interpolate(m, 0), 0.9);
  assert.equal(interpolate(m, 100), 0.1);
});

test('data-driven: learning risk comes from the predicted mark, and a higher mark never means higher risk', () => {
  const low = computeRiskAssessment({ ...base, learning: learning(30), config: CONFIG } as never);
  const high = computeRiskAssessment({ ...base, learning: learning(75), config: CONFIG } as never);
  assert.ok(low.riskScore > high.riskScore);
  assert.ok(Math.abs(low.factors.learningRisk! - 0.7667) < 0.001);
  assert.equal(low.factors.configSource, 'data');
});

test('data-driven cut-offs are used for the level; hand-set when no config', () => {
  assert.equal(levelForScore(40, CONFIG.levelCutoffs), 'MEDIUM');
  assert.equal(levelForScore(40), 'MEDIUM');
  assert.equal(levelForScore(48, CONFIG.levelCutoffs), 'MEDIUM');
  assert.equal(levelForScore(48), 'HIGH');
  const handSet = computeRiskAssessment({ ...base, learning: learning(30) } as never);
  assert.equal(handSet.factors.configSource, 'hand-set');
  assert.equal(handSet.factors.learningRisk, 0.35);       // STABLE trend, the old rule
});

test('config validation rejects malformed files', () => {
  assert.ok(parseRiskConfig(CONFIG));
  assert.equal(parseRiskConfig({ ...CONFIG, levelCutoffs: { MEDIUM: 60, HIGH: 50, CRITICAL: 75 } }), null);
  assert.equal(parseRiskConfig({ ...CONFIG, weights: { attendance: -1, learning: 1, knowledge: 1 } }), null);
  assert.equal(parseRiskConfig({ ...CONFIG, learningRiskMap: { x: [50, 20], y: [0.1, 0.2] } }), null);
  assert.equal(parseRiskConfig('nope'), null);
});

test('loader: reads the file when present, falls back to hand-set when missing or broken', () => {
  const dir = mkdtempSync(join(tmpdir(), 'risk-'));
  const path = join(dir, 'risk_config.json');
  const prev = process.env.RISK_CONFIG_PATH;
  process.env.RISK_CONFIG_PATH = path;
  try {
    assert.equal(loadRiskConfig(), null);
    writeFileSync(path, JSON.stringify(CONFIG));
    assert.deepEqual(loadRiskConfig()?.levelCutoffs, CONFIG.levelCutoffs);
    const warn = console.warn; console.warn = () => {};
    writeFileSync(path, '{"weights": 1}');
    const t = new Date(Date.now() + 5000);
    require('node:fs').utimesSync(path, t, t);
    assert.equal(loadRiskConfig(), null);
    console.warn = warn;
  } finally {
    if (prev === undefined) delete process.env.RISK_CONFIG_PATH; else process.env.RISK_CONFIG_PATH = prev;
    rmSync(dir, { recursive: true, force: true });
  }
});
