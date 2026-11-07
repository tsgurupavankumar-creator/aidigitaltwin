/** Academic year label for a date, e.g. "2026–27" (a year starts in July, as at VIT). */
export function academicYear(date = new Date()): string {
  const y = date.getFullYear();
  const start = date.getMonth() >= 6 ? y : y - 1;
  return `${start}–${String((start + 1) % 100).padStart(2, '0')}`;
}
