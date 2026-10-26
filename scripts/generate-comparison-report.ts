/**
 * Generates ml/reports/comparison.json: a REAL, measured comparison of the AI
 * Digital Twin against a rule-based "traditional dashboard", computed from the
 * live database. Nothing is invented; anything that cannot be measured is
 * written as null with a reason. The definitions, the ground-truth proxy and
 * the known limits (including circularity) are documented in
 * scripts/lib/comparison-metrics.ts and repeated inside the report itself.
 *
 * Run (needs DATABASE_URL in .env, and risk assessments to exist, i.e. run the
 * agents first):   npm run report:comparison
 */
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildComparisonReport, evaluateStudent, type StudentEvidence } from './lib/comparison-metrics';

const prisma = new PrismaClient();
const BATCH_SIZE = 10; // keeps the number of simultaneous queries modest on a pooled connection

async function loadEvidence(studentId: string): Promise<StudentEvidence> {
  const [attendance, quizAttempts, enrollments, riskAssessments, masteries] = await Promise.all([
    prisma.attendance.findMany({ where: { studentId }, select: { status: true, createdAt: true } }),
    prisma.quizAttempt.findMany({ where: { studentId }, select: { percentage: true, createdAt: true } }),
    prisma.enrollment.findMany({ where: { studentId }, select: { courseId: true } }),
    prisma.riskAssessment.findMany({ where: { studentId }, select: { riskLevel: true, createdAt: true } }),
    prisma.conceptMastery.findMany({ where: { studentId }, select: { masteryScore: true } }),
  ]);

  const courseIds = enrollments.map((e) => e.courseId);
  const assignments = courseIds.length
    ? await prisma.assignment.findMany({
        where: { courseId: { in: courseIds }, dueDate: { lt: new Date() } },
        select: { dueDate: true, submissions: { where: { studentId }, select: { id: true } } },
      })
    : [];

  return {
    studentId,
    attendance,
    quizAttempts,
    pastDueAssignments: assignments.map((a) => ({ dueDate: a.dueDate, hasSubmission: a.submissions.length > 0 })),
    riskAssessments,
    masteryScores: masteries.map((m) => m.masteryScore),
  };
}

async function main() {
  const students = await prisma.student.findMany({ select: { id: true } });
  if (students.length === 0) {
    throw new Error('No students found in the database, so there is nothing to compare.');
  }

  const evaluations = [];
  for (let i = 0; i < students.length; i += BATCH_SIZE) {
    const batch = students.slice(i, i + BATCH_SIZE);
    const evidence = await Promise.all(batch.map((s) => loadEvidence(s.id)));
    evaluations.push(...evidence.map(evaluateStudent));
  }

  const report = buildComparisonReport(evaluations);
  const outDir = join(__dirname, '..', 'ml', 'reports');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'comparison.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Wrote real comparison report to ${outPath}`);
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error('[COMPARISON_REPORT_ERROR]', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
