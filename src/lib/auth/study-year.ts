/**
 * Year and semester from a VIT-style roll number (24BCE0480 = admitted 2024) and today's date.
 * The academic year starts in July; July-December is an odd semester, January-June even.
 * Returns null when the roll number does not start with a 2-digit admission year. Students can
 * correct the values on their profile page.
 */
export function studyYearFromRoll(rollNumber: string, now = new Date()): { year: number; semester: number } | null {
  const m = rollNumber.trim().match(/^(\d{2})/);
  if (!m) return null;
  const admitted = 2000 + Number(m[1]);
  const ayStart = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const year = ayStart - admitted + 1;
  if (year < 1 || year > 6) return null;
  const oddHalf = now.getMonth() >= 6;
  return { year, semester: year * 2 - (oddHalf ? 1 : 0) };
}
