/** Course-scoped syllabus matching.  Pure so it can be regression-tested. */
export function normalizeConceptName(value: string): string {
  return value.toLocaleLowerCase('en').normalize('NFKC')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function conceptSimilarity(left: string, right: string): number {
  const a = normalizeConceptName(left), b = normalizeConceptName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

export function closestCourseConcept(name: string, concepts: ReadonlyArray<{id: string; name: string}>, threshold = 0.85) {
  let best: { id: string; name: string; score: number } | null = null;
  for (const concept of concepts) {
    const score = conceptSimilarity(name, concept.name);
    if (score >= threshold && (!best || score > best.score)) best = { ...concept, score };
  }
  return best;
}
