import { prisma } from '@/lib/prisma';
import { LEVELS, progression, prerequisiteScore, type ScoreMap, type CountMap, PREREQUISITE_THRESHOLD } from './progression';
import type { TopicLevelValue } from '@/lib/validation/practice';
/** Checks syllabus and topic ownership before any learning state is accessed. */
export async function ownedTopic(studentId: string, topicId: string) {
  return prisma.syllabusTopic.findFirst({ where: { id: topicId, module: { syllabus: { studentId, active: true } } },
    include: { module: { include: { syllabus: true } } } });
}
/** Returns each tier's persisted mastery; missing rows are treated as zero. */
export async function topicProgress(studentId: string, topicId: string) {
  const rows = await prisma.topicMastery.findMany({ where: { studentId, syllabusTopicId: topicId } });
  const scores: ScoreMap = { BEGINNER: 0, INTERMEDIATE: 0, ADVANCED: 0 };
  const counts: CountMap = { BEGINNER: 0, INTERMEDIATE: 0, ADVANCED: 0 };
  for (const r of rows) { scores[r.difficulty as TopicLevelValue] = r.masteryScore; counts[r.difficulty as TopicLevelValue] = r.attemptCount; }
  return progression(scores, counts);
}
/** Resolves same-module prerequisites and evaluates the highest attempted tier. */
export async function prerequisiteBlockers(studentId: string, topicId: string) {
  const topic = await ownedTopic(studentId, topicId);
  if (!topic) return null;
  const prereqs = await prisma.syllabusTopic.findMany({ where: { id: { in: topic.prerequisiteIds }, module: { syllabusId: topic.module.syllabusId } } });
  const blockers: { topicId: string; name: string; mastery: number }[] = [];
  for (const t of prereqs) {
    const p = await topicProgress(studentId, t.id);
    const score = prerequisiteScore(p.masteryScores, p.attemptCountByTier);
    if (score < PREREQUISITE_THRESHOLD) blockers.push({ topicId: t.id, name: t.name, mastery: score });
  }
  return blockers;
}
