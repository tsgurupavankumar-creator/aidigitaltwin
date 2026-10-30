/**
 * The single definition of "at risk" used by every screen, API and report.
 *
 * A student is at risk when their LATEST risk assessment is HIGH or CRITICAL
 * (risk score 45 or more). This matches the intervention trigger in the
 * orchestrator (HIGH creates a faculty intervention) and the AI flag used by
 * `npm run report:comparison`. MEDIUM is shown on screens as a level but is
 * not counted as "at risk".
 */
export const AT_RISK_LEVELS = ['HIGH', 'CRITICAL'] as const;

export function isAtRiskLevel(level: string | null | undefined): boolean {
  return level === 'HIGH' || level === 'CRITICAL';
}
