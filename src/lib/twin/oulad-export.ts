/**
 * Turns the app's records into OULAD's file format, so ml/train_*.py can be re-run on the
 * app's own students unchanged (OULAD_DIR=<export folder>). Mapping:
 *   course            -> code_module = course code, code_presentation = "S<semester>"
 *   quiz              -> assessment type CMA, date = days from course start to quiz creation
 *   assignment        -> assessment type TMA, date = days from course start to due date
 *   first quiz attempt / graded submission -> studentAssessment (score as %)
 *   attended lecture  -> one studentVle row on the lecture day (the app's "online activity")
 *   final result      -> from a faculty-provided CSV (rollNumber, courseCode, result); the app
 *                        does not store course results. Students without one are left out.
 * Course start = first lecture date (else course creation). No demographics are exported.
 */
export interface ExportInput {
  courses: Array<{ id: string; code: string; semester: number | null; createdAt: Date }>;
  lectures: Array<{ id: string; courseId: string; date: Date }>;
  enrollments: Array<{ studentId: string; courseId: string; enrolledAt: Date }>;
  students: Array<{ id: string; rollNumber: string }>;
  quizzes: Array<{ id: string; courseId: string; createdAt: Date }>;
  assignments: Array<{ id: string; courseId: string; dueDate: Date }>;
  attempts: Array<{ studentId: string; quizId: string; percentage: number; createdAt: Date }>;
  submissions: Array<{ studentId: string; assignmentId: string; marksObtained: number | null; maxMarks: number; submittedAt: Date | null; updatedAt: Date }>;
  attendance: Array<{ studentId: string; lectureId: string; status: string }>;
  outcomes: Array<{ rollNumber: string; courseCode: string; result: string }>;
}

export const RESULTS = ['Pass', 'Fail', 'Withdrawn', 'Distinction'];
const DAY = 86_400_000;

export function buildOuladTables(d: ExportInput) {
  const start = new Map<string, Date>();
  for (const c of d.courses) {
    const first = d.lectures.filter((l) => l.courseId === c.id).map((l) => l.date.getTime()).sort((a, b) => a - b)[0];
    start.set(c.id, new Date(first ?? c.createdAt.getTime()));
  }
  const days = (courseId: string, at: Date) => Math.floor((at.getTime() - start.get(courseId)!.getTime()) / DAY);
  const course = new Map(d.courses.map((c) => [c.id, c]));
  const module = (cid: string) => course.get(cid)!.code;
  const pres = (cid: string) => `S${course.get(cid)!.semester ?? 0}`;
  const roll = new Map(d.students.map((s) => [s.id, s.rollNumber]));
  const outcome = new Map(d.outcomes.map((o) => [`${o.rollNumber.toUpperCase()}|${o.courseCode.toUpperCase()}`, o.result]));
  const resultFor = (sid: string, cid: string) => outcome.get(`${(roll.get(sid) ?? '').toUpperCase()}|${module(cid).toUpperCase()}`);

  const studentInfo = d.enrollments.filter((e) => RESULTS.includes(resultFor(e.studentId, e.courseId) ?? ''))
    .map((e) => ({ code_module: module(e.courseId), code_presentation: pres(e.courseId), id_student: e.studentId, final_result: resultFor(e.studentId, e.courseId)! }));
  const included = new Set(studentInfo.map((r) => `${r.id_student}|${r.code_module}|${r.code_presentation}`));
  const keep = (sid: string, cid: string) => included.has(`${sid}|${module(cid)}|${pres(cid)}`);

  const assessments = [
    ...d.quizzes.map((q) => ({ code_module: module(q.courseId), code_presentation: pres(q.courseId), id_assessment: q.id, assessment_type: 'CMA', date: days(q.courseId, q.createdAt), weight: '' })),
    ...d.assignments.map((a) => ({ code_module: module(a.courseId), code_presentation: pres(a.courseId), id_assessment: a.id, assessment_type: 'TMA', date: days(a.courseId, a.dueDate), weight: '' })),
  ];
  const quizCourse = new Map(d.quizzes.map((q) => [q.id, q.courseId]));
  const asgCourse = new Map(d.assignments.map((a) => [a.id, a.courseId]));
  const firstAttempt = new Map<string, (typeof d.attempts)[number]>();
  for (const a of [...d.attempts].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())) {
    const k = `${a.studentId}|${a.quizId}`;
    if (!firstAttempt.has(k)) firstAttempt.set(k, a);
  }
  const studentAssessment = [
    ...[...firstAttempt.values()].filter((a) => keep(a.studentId, quizCourse.get(a.quizId)!))
      .map((a) => ({ id_assessment: a.quizId, id_student: a.studentId, date_submitted: days(quizCourse.get(a.quizId)!, a.createdAt), is_banked: 0, score: Math.round(a.percentage * 10) / 10 })),
    ...d.submissions.filter((s) => s.marksObtained !== null && s.maxMarks > 0 && keep(s.studentId, asgCourse.get(s.assignmentId)!))
      .map((s) => ({ id_assessment: s.assignmentId, id_student: s.studentId, date_submitted: days(asgCourse.get(s.assignmentId)!, s.submittedAt ?? s.updatedAt), is_banked: 0, score: Math.round((s.marksObtained! / s.maxMarks) * 1000) / 10 })),
  ];
  const lecture = new Map(d.lectures.map((l) => [l.id, l]));
  const studentVle = d.attendance.filter((a) => (a.status === 'PRESENT' || a.status === 'LATE') && lecture.has(a.lectureId) && keep(a.studentId, lecture.get(a.lectureId)!.courseId))
    .map((a) => { const l = lecture.get(a.lectureId)!; return { code_module: module(l.courseId), code_presentation: pres(l.courseId), id_student: a.studentId, id_site: 0, date: days(l.courseId, l.date), sum_click: 1 }; });
  const studentRegistration = d.enrollments.filter((e) => keep(e.studentId, e.courseId))
    .map((e) => ({ code_module: module(e.courseId), code_presentation: pres(e.courseId), id_student: e.studentId, date_registration: days(e.courseId, e.enrolledAt), date_unregistration: '?' }));
  return { studentInfo, assessments, studentAssessment, studentVle, studentRegistration };
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const esc = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}
