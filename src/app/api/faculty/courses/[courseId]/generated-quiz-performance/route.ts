import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
type Ctx = { params: Promise<{ courseId: string }> };

/** Supplementary quiz evidence, separate from authoritative tier mastery. */
export async function GET(_request: Request, ctx: Ctx) {
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;
  const { courseId } = await ctx.params;
  const course = await prisma.course.findFirst({ where: { id: courseId, facultyId: auth.user.faculty!.id }, select: { id: true } });
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  const rows = await prisma.quizResponse.findMany({
    where: {
      attempt: {
        student: { enrollments: { some: { courseId } } },
        quiz: { courseId, isAIGenerated: true, OR: [{ sessionKind: 'generated' }, { sessionKind: null }], syllabus: { active: true, courseId } },
      },
      question: { syllabusTopicId: { not: null } },
    },
    select: {
      isCorrect: true,
      attempt: { select: {
        studentId: true, createdAt: true,
        student: { select: { fullName: true, rollNumber: true } },
        quiz: { select: { ownerStudentId: true, syllabusId: true } },
      } },
      question: { select: {
        syllabusTopicId: true,
        syllabusTopic: { select: { name: true, module: { select: { syllabusId: true, syllabus: { select: { studentId: true } } } } } },
      } },
    },
  });
  const summary = new Map<string, { topic: string; studentId: string; fullName: string; rollNumber: string; correct: number; answered: number; lastAt: string }>();
  for (const row of rows) {
    const topic = row.question.syllabusTopic;
    const owner = row.attempt.studentId;
    if (!topic || row.attempt.quiz.ownerStudentId !== owner || row.attempt.quiz.syllabusId !== topic.module.syllabusId || topic.module.syllabus.studentId !== owner) continue;
    const key = `${owner}:${row.question.syllabusTopicId}`;
    const current = summary.get(key) ?? { topic: topic.name, studentId: owner, fullName: row.attempt.student.fullName, rollNumber: row.attempt.student.rollNumber, correct: 0, answered: 0, lastAt: '' };
    current.correct += Number(row.isCorrect);
    current.answered += 1;
    const timestamp = row.attempt.createdAt.toISOString();
    if (timestamp > current.lastAt) current.lastAt = timestamp;
    summary.set(key, current);
  }
  return NextResponse.json({ rows: [...summary.values()].map(r => ({ ...r, percentage: Math.round(100 * r.correct / r.answered) })).sort((a,b) => a.topic.localeCompare(b.topic) || a.fullName.localeCompare(b.fullName)) });
}
