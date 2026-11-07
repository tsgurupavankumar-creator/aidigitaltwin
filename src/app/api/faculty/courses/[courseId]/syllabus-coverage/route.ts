import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
type Ctx = { params: Promise<{ courseId: string }> };
/** Aggregate syllabus coverage without exposing another faculty member's class. */
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;
  if (process.env.PRACTICE_TIER_ENABLED !== 'true') return NextResponse.json({ error: 'Feature disabled' }, { status: 404 });
  const { courseId } = await ctx.params;
  const course = await prisma.course.findFirst({ where: { id: courseId, facultyId: auth.user.faculty!.id },
    select: { id: true, code: true, name: true, _count: { select: { enrollments: true } } } });
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  const syllabi = await prisma.courseSyllabus.findMany({ where: { courseId, active: true },
    select: { studentId: true, modules: { select: { estimatedMinutes: true, topics: { select: { conceptId: true, name: true } } } } } });
  const uploaded = new Set(syllabi.map(s => s.studentId));
  const coveredConceptIds = [...new Set(syllabi.flatMap(s => s.modules.flatMap(m => m.topics.map(t => t.conceptId))).filter((v): v is string => v !== null))];
  const concepts = await prisma.concept.findMany({ where: { courseId }, select: { id: true, name: true } });
  const covered = new Set(coveredConceptIds);
  return NextResponse.json({ course, enrolledStudents: course._count.enrollments, studentsWithSyllabus: uploaded.size,
    coveredConcepts: concepts.filter(c => covered.has(c.id)).length,
    uncoveredConcepts: concepts.filter(c => !covered.has(c.id)).map(c => ({ id: c.id, name: c.name })),
    unmappedTopicCount: syllabi.flatMap(s => s.modules.flatMap(m => m.topics)).filter(t => !t.conceptId).length,
    averageEstimatedMinutes: (() => {
      const estimates: number[] = [];

      for (const syllabus of syllabi) {
        if (
          syllabus.modules.length === 0 ||
          syllabus.modules.some(m => m.estimatedMinutes === null)
        ) {
          continue;
        }

        const total = syllabus.modules.reduce(
          (sum: number, m) => sum + (m.estimatedMinutes ?? 0),
          0
        );

        estimates.push(total);
      }

      return estimates.length > 0
        ? Math.round(
            estimates.reduce((sum: number, n: number) => sum + n, 0)
            / estimates.length
          )
        : null;
    })() });
}
