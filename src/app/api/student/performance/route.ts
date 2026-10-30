import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { examScoreToGpa } from '@/lib/agents/risk-scoring';
import { academicYear } from '@/lib/twin/academic-year';

/**
 * Everything here is real data or a real model prediction; missing data is null (shown as
 * "not enough data yet"), never a default.
 *  - history: each scored quiz (first attempt) and graded assignment, oldest first, with the REAL
 *    class average on that same item (first attempts / graded submissions of every student)
 *  - currentGrade: 10-point equivalent of the student's average mark so far
 *  - predictedGpa + markRange: from the latest risk assessment (marks model and its 80% range)
 */
export async function GET() {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;

  try {
    const studentId = auth.user.student!.id;
    const [twin, risk, attempts, submissions, masteries] = await Promise.all([
      prisma.digitalTwin.findUnique({ where: { studentId }, select: { academicHealth: true } }),
      prisma.riskAssessment.findFirst({ where: { studentId }, orderBy: { createdAt: 'desc' }, select: { predictedGPA: true, factors: true, createdAt: true } }),
      prisma.quizAttempt.findMany({ where: { studentId }, orderBy: { createdAt: 'asc' }, select: { quizId: true, percentage: true, createdAt: true, quiz: { select: { title: true } } } }),
      prisma.submission.findMany({
        where: { studentId, marksObtained: { not: null } },
        select: { assignmentId: true, marksObtained: true, submittedAt: true, updatedAt: true, assignment: { select: { title: true, maxMarks: true } } },
      }),
      prisma.conceptMastery.findMany({ where: { studentId, assessmentCount: { gt: 0 } }, select: { masteryScore: true } }),
    ]);

    // First attempt per quiz (later attempts are retakes).
    const firstAttempt = new Map<string, (typeof attempts)[number]>();
    for (const a of attempts) if (!firstAttempt.has(a.quizId)) firstAttempt.set(a.quizId, a);
    const graded = submissions.filter((s) => s.assignment.maxMarks > 0);

    // Real class averages on the same items.
    const [classAttempts, classSubs] = await Promise.all([
      firstAttempt.size ? prisma.quizAttempt.findMany({ where: { quizId: { in: [...firstAttempt.keys()] } }, orderBy: { createdAt: 'asc' }, select: { quizId: true, studentId: true, percentage: true } }) : Promise.resolve([]),
      graded.length ? prisma.submission.findMany({ where: { assignmentId: { in: graded.map((s) => s.assignmentId) }, marksObtained: { not: null } }, select: { assignmentId: true, marksObtained: true, assignment: { select: { maxMarks: true } } } }) : Promise.resolve([]),
    ]);
    const quizMean = new Map<string, number>();
    {
      const seen = new Set<string>(); const acc = new Map<string, number[]>();
      for (const a of classAttempts) { const k = `${a.quizId}|${a.studentId}`; if (seen.has(k)) continue; seen.add(k); acc.set(a.quizId, [...(acc.get(a.quizId) ?? []), a.percentage]); }
      for (const [k, v] of acc) quizMean.set(k, v.reduce((x, y) => x + y, 0) / v.length);
    }
    const asgMean = new Map<string, number>();
    {
      const acc = new Map<string, number[]>();
      for (const s of classSubs) if (s.assignment.maxMarks > 0) acc.set(s.assignmentId, [...(acc.get(s.assignmentId) ?? []), (s.marksObtained! / s.assignment.maxMarks) * 100]);
      for (const [k, v] of acc) asgMean.set(k, v.reduce((x, y) => x + y, 0) / v.length);
    }

    const history = [
      ...[...firstAttempt.values()].map((a) => ({ label: a.quiz.title, kind: 'quiz' as const, date: a.createdAt, score: a.percentage, classAvg: quizMean.get(a.quizId) ?? null })),
      ...graded.map((s) => ({ label: s.assignment.title, kind: 'assignment' as const, date: s.submittedAt ?? s.updatedAt, score: (s.marksObtained! / s.assignment.maxMarks) * 100, classAvg: asgMean.get(s.assignmentId) ?? null })),
    ].sort((x, y) => x.date.getTime() - y.date.getTime())
      .map((h) => ({ ...h, date: h.date.toISOString(), score: Math.round(h.score), classAvg: h.classAvg === null ? null : Math.round(h.classAvg) }));

    const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
    const averageMark = avg(history.map((h) => h.score));
    const range = (risk?.factors as { predictedRange?: { low: number; high: number } | null } | null)?.predictedRange ?? null;

    return NextResponse.json({
      data: {
        currentGrade: averageMark === null ? null : examScoreToGpa(averageMark),
        averageMark: averageMark === null ? null : Math.round(averageMark),
        predictedGpa: risk?.predictedGPA ?? null,
        markRange: range,
        predictedAt: risk?.createdAt ?? null,
        syllabusMastery: (() => { const m = avg(masteries.map((x) => x.masteryScore)); return m === null ? null : Math.round(m); })(),
        academicHealth: twin ? Math.round(twin.academicHealth) : null,
        academicYear: academicYear(),
        history,
      },
    });
  } catch (error) {
    console.error('[STUDENT_PERFORMANCE_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch performance data' }, { status: 500 });
  }
}
