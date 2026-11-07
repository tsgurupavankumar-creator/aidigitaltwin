import { createHash } from 'crypto';
/** A stable content signature; order of MCQ options does not affect the hash. */
export function computeQuestionHash(prompt: string, options: string[] = []): string {
  const normalize = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');
  const payload = `${normalize(prompt)}|${options.map(normalize).sort().join('|')}`;
  return createHash('sha256').update(payload).digest('hex');
}
/** Scoped unique deduplication key, enforced by the database. */
export function questionDedupKey(studentId: string, topicId: string, tier: string, hash: string): string {
  return createHash('sha256').update([studentId, topicId, tier, hash].join('|')).digest('hex');
}
