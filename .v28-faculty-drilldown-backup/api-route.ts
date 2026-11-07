import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
type Ctx = { params: Promise<{ courseId: string }> };
/** Aggregates course students' topic-tier progress; no cross-course data is loaded. */
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;
  if (process.env.PRACTICE_TIER_ENABLED !== 'true') return NextResponse.json({ error: 'Feature disabled' }, { status: 404 });
  const { courseId } = await ctx.params;
  const course = await prisma.course.findFirst({ where: { id: courseId, facultyId: auth.user.faculty!.id }, select: { id: true, code: true, name: true } });
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  const rows = await prisma.topicMastery.findMany({ where: { syllabusTopic: { module: { syllabus: { courseId, active: true } } } },
    select: { studentId: true, difficulty: true, masteryScore: true, totalTimeSec: true,
      syllabusTopic: { select: { id: true, name: true, conceptId: true } } } });
  const tierRank: Record<string, number> = {
    BEGINNER: 1,
    INTERMEDIATE: 2,
    ADVANCED: 3
  };

  type StudentProgress = {
    tier: number;
    score: number;
    totalTimeSec: number;
  };

  type TopicGroup = {
    topic: string;
    students: Map<string, StudentProgress>;
    tierCounts: Record<string, number>;
  };

  const groups = new Map<string, TopicGroup>();

  for (const row of rows) {
    const key = row.syllabusTopic.conceptId ||
      row.syllabusTopic.name.trim().toLowerCase().replace(/\s+/g, ' ');

    if (!groups.has(key)) {
      groups.set(key, {
        topic: row.syllabusTopic.name,
        students: new Map<string, StudentProgress>(),
        tierCounts: {}
      });
    }

    const group = groups.get(key)!;
    const rank = tierRank[row.difficulty];
    const previous = group.students.get(row.studentId);

    group.tierCounts[row.difficulty] =
      (group.tierCounts[row.difficulty] || 0) + 1;

    if (!previous) {
      group.students.set(row.studentId, {
        tier: rank,
        score: row.masteryScore,
        totalTimeSec: row.totalTimeSec
      });
    } else {
      const higherTier = rank > previous.tier;

      group.students.set(row.studentId, {
        tier: higherTier ? rank : previous.tier,
        score: higherTier ? row.masteryScore : previous.score,
        totalTimeSec: previous.totalTimeSec + row.totalTimeSec
      });
    }
  }

  const topics = [...groups.entries()].map(([key, group]) => {
    const students = [...group.students.values()];

    return {
      key,
      name: group.topic,
      students: students.length,
      stuckStudents: students.filter(s => s.score < 0.5).length,
      advancingStudents: students.filter(s => s.score >= 0.7).length,
      averageTimeMinutes: students.length
        ? Math.round(
            students.reduce((sum, s) => sum + s.totalTimeSec, 0)
            / students.length / 60
          )
        : 0,
      tierCounts: group.tierCounts
    };
  }).sort((a, b) => b.stuckStudents - a.stuckStudents);

  return NextResponse.json({ course, topics, groupingNote: 'Unmapped topics are grouped by normalized exact name, not fuzzy similarity.' });
}
