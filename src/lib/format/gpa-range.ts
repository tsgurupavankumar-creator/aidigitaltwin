const GPA_MIN = 0;
const GPA_MAX = 4;
const GPA_MARGIN = 0.2;

export function formatGpaRange(predictedGpa: number): string {
  const lower = Math.max(GPA_MIN, predictedGpa - GPA_MARGIN);
  const upper = Math.min(GPA_MAX, predictedGpa + GPA_MARGIN);
  return `${lower.toFixed(2)} - ${upper.toFixed(2)}`;
}
