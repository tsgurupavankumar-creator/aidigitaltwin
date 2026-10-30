import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import type { RiskConfig } from './risk-scoring';

/**
 * Loads ml/models/risk_config.json (written by ml/calibrate_risk_score.py),
 * re-reading it when the file changes. Returns null (hand-set defaults are
 * used) when the file is missing or malformed. RISK_CONFIG_PATH overrides the
 * location.
 */
let cache: { path: string; mtimeMs: number; config: RiskConfig | null } | null = null;

export function riskConfigPath(): string {
  return process.env.RISK_CONFIG_PATH || join(process.cwd(), 'ml', 'models', 'risk_config.json');
}

export function parseRiskConfig(raw: unknown): RiskConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, any>;
  const w = c.weights, cut = c.levelCutoffs, map = c.learningRiskMap;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (!w || ![w.attendance, w.knowledge, w.learning].every(num) || w.attendance < 0 || w.knowledge < 0 || w.learning < 0) return null;
  if (!cut || ![cut.MEDIUM, cut.HIGH, cut.CRITICAL].every(num) || !(cut.MEDIUM <= cut.HIGH && cut.HIGH <= cut.CRITICAL)) return null;
  let learningRiskMap: RiskConfig['learningRiskMap'];
  if (map) {
    if (!Array.isArray(map.x) || !Array.isArray(map.y) || map.x.length !== map.y.length || map.x.length < 2) return null;
    if (![...map.x, ...map.y].every(num)) return null;
    if (map.x.some((v: number, i: number) => i > 0 && v < map.x[i - 1])) return null;
    learningRiskMap = { x: map.x, y: map.y };
  }
  return {
    weights: { attendance: w.attendance, knowledge: w.knowledge, learning: w.learning },
    levelCutoffs: { MEDIUM: cut.MEDIUM, HIGH: cut.HIGH, CRITICAL: cut.CRITICAL },
    learningRiskMap,
    generatedAt: typeof c.generatedAt === 'string' ? c.generatedAt : undefined,
  };
}

export function loadRiskConfig(): RiskConfig | null {
  const path = riskConfigPath();
  try {
    const { mtimeMs } = statSync(path);
    if (cache && cache.path === path && cache.mtimeMs === mtimeMs) return cache.config;
    const config = parseRiskConfig(JSON.parse(readFileSync(path, 'utf8')));
    if (!config) console.warn(`[RISK] ${path} is malformed; using hand-set risk settings.`);
    cache = { path, mtimeMs, config };
    return config;
  } catch {
    return null;   // no file: hand-set defaults
  }
}
