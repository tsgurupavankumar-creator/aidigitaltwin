/**
 * 10-point grade (VIT CGPA scale). The range comes from the marks model's 80% range (low/high
 * marks), so it is a real uncertainty, not an invented +/- margin. Without a range, one value.
 */
export const GPA_SCALE = 10;

const toGpa = (mark: number) => Math.max(0, Math.min(GPA_SCALE, mark / 10));

export function formatGpa(gpa: number | null | undefined): string {
  return gpa === null || gpa === undefined || !Number.isFinite(gpa) ? '—' : gpa.toFixed(1);
}

/** predictedGpa on the 10-point scale; markRange = the marks model's 80% range (0-100), if known. */
export function formatGpaRange(predictedGpa: number | null | undefined, markRange?: { low: number; high: number } | null): string {
  if (predictedGpa === null || predictedGpa === undefined || !Number.isFinite(predictedGpa)) return '—';
  if (!markRange) return `≈ ${predictedGpa.toFixed(1)}`;
  return `${toGpa(markRange.low).toFixed(1)} – ${toGpa(markRange.high).toFixed(1)}`;
}
