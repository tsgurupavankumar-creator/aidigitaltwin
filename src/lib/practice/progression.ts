import type { TopicLevelValue } from '@/lib/validation/practice';
export const LEVELS: TopicLevelValue[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
export const MASTERY_UNLOCK_THRESHOLD = 0.70;
export const PREREQUISITE_THRESHOLD = 0.50;
export type ScoreMap = Record<TopicLevelValue, number>;
export type CountMap = Record<TopicLevelValue, number>;
/** Computes the unlocked tiers from live mastery. A score of exactly 0.70 unlocks. */
export function progression(scores: ScoreMap, attempts?: CountMap) {
  const unlocked = LEVELS.filter((tier, i) => i === 0 || (i === 1 ? scores.BEGINNER : Math.min(scores.BEGINNER, scores.INTERMEDIATE)) >= MASTERY_UNLOCK_THRESHOLD);
  const isMastered = scores.BEGINNER >= .7 && scores.INTERMEDIATE >= .7 && scores.ADVANCED >= .7;
  const recommendation = isMastered ? null : (unlocked.find(t => scores[t] < MASTERY_UNLOCK_THRESHOLD) || 'BEGINNER');
  return { currentTier: recommendation || 'ADVANCED', masteryScores: scores, unlockedTiers: unlocked,
    recommendation, recommendationReason: !attempts || Object.values(attempts).every(n => n === 0) ? 'Start here' : isMastered ? 'Topic mastered' : `Keep practising ${recommendation}`,
    isMastered, attemptCountByTier: attempts || { BEGINNER: 0, INTERMEDIATE: 0, ADVANCED: 0 } };
}
/** Use the highest tier with at least one attempt to evaluate prerequisite mastery. */
export function prerequisiteScore(scores: ScoreMap, counts: CountMap): number {
  const level = [...LEVELS].reverse().find(t => counts[t] > 0);
  return level ? scores[level] : 0;
}
