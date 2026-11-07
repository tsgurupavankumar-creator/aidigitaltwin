/** Attendance % from records, the same rule the agents use: PRESENT or LATE count as attended,
 *  EXCUSED is left out. null when nothing is recorded (never a default). */
export function attendanceRate(statuses: string[]): number | null {
  const counted = statuses.filter((s) => s !== 'EXCUSED');
  if (!counted.length) return null;
  return Math.round((100 * counted.filter((s) => s === 'PRESENT' || s === 'LATE').length) / counted.length);
}

/** The marks model's 80% range stored with a risk assessment, if any. */
export function markRangeOf(factors: unknown): { low: number; high: number } | null {
  const r = (factors as { predictedRange?: { low?: unknown; high?: unknown } } | null)?.predictedRange;
  return r && typeof r.low === 'number' && typeof r.high === 'number' ? { low: r.low, high: r.high } : null;
}
