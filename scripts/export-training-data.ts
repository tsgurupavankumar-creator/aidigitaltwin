/**
 * Exports the app's data in OULAD format for retraining on your own students (needs DATABASE_URL).
 *   npm run ml:export -- outcomes.csv            (writes ml/app_data/*.csv)
 * outcomes.csv: rollNumber,courseCode,result   with result Pass, Fail, Withdrawn or Distinction.
 * Then:  cd ml && OULAD_DIR=app_data python train_learning_analysis.py  (and the other scripts)
 * Train on app data only after a full course run with enough students (hundreds, ideally).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { parseCsv, requireHeaders } from '../src/lib/twin/csv';
import { buildOuladTables, RESULTS, toCsv } from '../src/lib/twin/oulad-export';

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: npm run ml:export -- outcomes.csv   (columns: rollNumber, courseCode, result)');
  const table = parseCsv(readFileSync(file, 'utf8'));
  requireHeaders(table, ['rollNumber', 'courseCode', 'result']);
  const outcomes = table.rows.map((r) => ({ rollNumber: r.rollnumber, courseCode: r.coursecode, result: r.result }));
  const bad = outcomes.filter((o) => !RESULTS.includes(o.result));
  if (bad.length) throw new Error(`Unknown result(s): ${[...new Set(bad.map((b) => b.result))].join(', ')}. Use ${RESULTS.join(', ')}.`);

  const prisma = new PrismaClient();
  try {
    const [courses, lectures, enrollments, students, quizzes, assignments, attempts, submissions, attendance] = await Promise.all([
      prisma.course.findMany({ select: { id: true, code: true, semester: true, createdAt: true } }),
      prisma.lecture.findMany({ select: { id: true, courseId: true, date: true } }),
      prisma.enrollment.findMany({ select: { studentId: true, courseId: true, enrolledAt: true } }),
      prisma.student.findMany({ select: { id: true, rollNumber: true } }),
      prisma.quiz.findMany({ select: { id: true, courseId: true, createdAt: true } }),
      prisma.assignment.findMany({ select: { id: true, courseId: true, dueDate: true } }),
      prisma.quizAttempt.findMany({ select: { studentId: true, quizId: true, percentage: true, createdAt: true } }),
      prisma.submission.findMany({ select: { studentId: true, assignmentId: true, marksObtained: true, submittedAt: true, updatedAt: true, assignment: { select: { maxMarks: true } } } }),
      prisma.attendance.findMany({ select: { studentId: true, lectureId: true, status: true } }),
    ]);
    const t = buildOuladTables({
      courses, lectures, enrollments, students, quizzes, assignments, attempts, attendance, outcomes,
      submissions: submissions.map((s) => ({ ...s, maxMarks: s.assignment.maxMarks })),
    });
    const dir = join(process.cwd(), 'ml', 'app_data');
    mkdirSync(dir, { recursive: true });
    const cols: Record<string, string[]> = {
      studentInfo: ['code_module', 'code_presentation', 'id_student', 'final_result'],
      assessments: ['code_module', 'code_presentation', 'id_assessment', 'assessment_type', 'date', 'weight'],
      studentAssessment: ['id_assessment', 'id_student', 'date_submitted', 'is_banked', 'score'],
      studentVle: ['code_module', 'code_presentation', 'id_student', 'id_site', 'date', 'sum_click'],
      studentRegistration: ['code_module', 'code_presentation', 'id_student', 'date_registration', 'date_unregistration'],
    };
    for (const [name, rows] of Object.entries(t)) writeFileSync(join(dir, `${name}.csv`), toCsv(rows as Array<Record<string, unknown>>, cols[name]));
    console.log(`Exported ${t.studentInfo.length} student-course rows with a final result to ml/app_data/.`);
    if (t.studentInfo.length < 200) console.log('Note: fewer than 200 rows; results from training on this would not be reliable.');
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
