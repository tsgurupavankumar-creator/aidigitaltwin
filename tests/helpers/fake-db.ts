/**
 * A small in-memory stand-in for the Prisma calls made by the twin data layer,
 * the orchestrator and the attendance agent. Only the shapes those modules use
 * are supported. Every row gets id/createdAt/updatedAt like Prisma would.
 */
type Row = Record<string, any>;
type Where = Record<string, any>;

let clock = Date.parse('2026-10-17T10:00:00.000Z');
const tick = () => new Date((clock += 1000));
let seq = 0;
const id = (p: string) => `${p}${++seq}`;

const COMPOUND: Record<string, string[]> = {
  studentId_lectureId: ['studentId', 'lectureId'],
  studentId_assignmentId: ['studentId', 'assignmentId'],
  studentId_conceptId: ['studentId', 'conceptId'],
  studentId_courseId: ['studentId', 'courseId'],
};

function flatten(where: Where = {}): Where {
  const out: Where = {};
  for (const [k, v] of Object.entries(where)) {
    if (COMPOUND[k]) Object.assign(out, v);
    else out[k] = v;
  }
  return out;
}

function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(flatten(where)).every(([k, cond]) => {
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond) return cond.in.includes(row[k]);
      if ('equals' in cond) return cond.mode === 'insensitive' ? String(row[k]).toLowerCase() === String(cond.equals).toLowerCase() : row[k] === cond.equals;
      return true; // relation filters are handled by the table methods that need them
    }
    return row[k] === cond;
  });
}

function table(name: string, db: FakeDb) {
  const rows = (): Row[] => db.tables[name];
  const sortRows = (list: Row[], orderBy?: any) => {
    if (!orderBy) return list;
    const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
    return [...list].sort((a, b) => {
      for (const o of orders) {
        const [k, dir] = Object.entries(o)[0] as [string, string];
        if (typeof dir !== 'string') continue;
        const av = a[k] instanceof Date ? a[k].getTime() : a[k];
        const bv = b[k] instanceof Date ? b[k].getTime() : b[k];
        if (av < bv) return dir === 'asc' ? -1 : 1;
        if (av > bv) return dir === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };
  return {
    findMany: async (args: any = {}) => {
      let list = rows().filter((r) => matches(r, args.where));
      list = sortRows(list, args.orderBy);
      if (args.take) list = list.slice(0, args.take);
      return list.map((r) => ({ ...r }));
    },
    findFirst: async (args: any = {}) => {
      const list = sortRows(rows().filter((r) => matches(r, args.where)), args.orderBy);
      return list[0] ? { ...list[0] } : null;
    },
    findUnique: async (args: any) => {
      const r = rows().find((x) => matches(x, args.where));
      return r ? { ...r } : null;
    },
    count: async (args: any = {}) => rows().filter((r) => matches(r, args.where)).length,
    create: async (args: any) => {
      const now = tick();
      const r = { id: id(name.slice(0, 3)), createdAt: now, updatedAt: now, ...args.data };
      rows().push(r);
      return { ...r };
    },
    createMany: async (args: any) => {
      for (const d of args.data) { const now = tick(); rows().push({ id: id(name.slice(0, 3)), createdAt: now, updatedAt: now, ...d }); }
      return { count: args.data.length };
    },
    update: async (args: any) => {
      const r = rows().find((x) => matches(x, args.where));
      if (!r) throw new Error(`${name}.update: not found`);
      Object.assign(r, args.data, { updatedAt: tick() });
      return { ...r };
    },
    upsert: async (args: any) => {
      const r = rows().find((x) => matches(x, args.where));
      if (r) { Object.assign(r, args.update, { updatedAt: tick() }); return { ...r }; }
      const now = tick();
      const created = { id: id(name.slice(0, 3)), createdAt: now, updatedAt: now, ...args.create };
      rows().push(created);
      return { ...created };
    },
  };
}

export class FakeDb {
  tables: Record<string, Row[]> = {
    course: [], enrollment: [], student: [], faculty: [], lecture: [], attendance: [], assignment: [], submission: [],
    question: [], quiz: [], quizAttempt: [], quizResponse: [], concept: [], conceptMastery: [], digitalTwin: [],
    agentLog: [], alert: [], recommendation: [], intervention: [], riskAssessment: [], classInsight: [], conceptEdge: [], twinSnapshot: [], studyTask: [], studyPlan: [],
  };
  [key: string]: any;

  constructor() {
    for (const name of Object.keys(this.tables)) this[name] = table(name, this);
    const base = this.enrollment;
    // enrollment.findMany with select.student / distinct courseId
    this.enrollment = {
      ...base,
      findMany: async (args: any = {}) => {
        let list = this.tables.enrollment.filter((r) => matches(r, args.where));
        if (args.distinct) list = list.filter((r, i, all) => all.findIndex((x) => x.courseId === r.courseId) === i);
        if (args.select?.student) return list.map((e) => ({ studentId: e.studentId, courseId: e.courseId, student: { ...this.tables.student.find((s) => s.id === e.studentId) } }));
        return list.map((r) => ({ ...r }));
      },
    };
    // assignment.findFirst/findUnique with questions; lecture.findFirst with attendance
    const assignment = this.assignment;
    const withQuestions = (a: Row | null) => a && { ...a, questions: this.tables.question.filter((q) => q.assignmentId === a.id).map((q) => ({ conceptId: q.conceptId })) };
    this.assignment = { ...assignment, findFirst: async (args: any) => withQuestions(await assignment.findFirst(args)), findUnique: async (args: any) => withQuestions(await assignment.findUnique(args)) };
    const quiz = this.quiz;
    this.quiz = { ...quiz, findUnique: async (args: any) => { const q = await quiz.findUnique(args); return q && { ...q, course: this.tables.course.find((c) => c.id === q.courseId), questions: this.tables.question.filter((x) => x.quizId === q.id).map((x) => ({ ...x, concept: this.tables.concept.find((c) => c.id === x.conceptId) })) }; } };
    // include: { concept } on mastery; include: { assignment } on submissions
    const mastery = this.conceptMastery;
    this.conceptMastery = {
      ...mastery,
      findMany: async (args: any = {}) => {
        const courseFilter = args.where?.concept?.courseId?.in as string[] | undefined;
        const list = (await mastery.findMany(args)).map((m: Row) => ({ ...m, concept: this.tables.concept.find((c) => c.id === m.conceptId) }));
        return courseFilter ? list.filter((m: Row) => courseFilter.includes(m.concept?.courseId)) : list;
      },
    };
    const submission = this.submission;
    this.submission = {
      ...submission,
      findMany: async (args: any = {}) => (await submission.findMany(args)).map((x: Row) => ({ ...x, assignment: this.tables.assignment.find((a) => a.id === x.assignmentId) })),
    };
    // student.findFirst with "enrolled in a course this faculty member teaches"
    const student = this.student;
    this.student = {
      ...student,
      findFirst: async (args: any = {}) => {
        const facultyId = args.where?.enrollments?.some?.course?.facultyId;
        if (facultyId === undefined) return student.findFirst(args);
        const courses = new Set(this.tables.course.filter((c) => c.facultyId === facultyId).map((c) => c.id));
        const ok = (sid: string) => this.tables.enrollment.some((e) => e.studentId === sid && courses.has(e.courseId));
        const hit = this.tables.student.find((s) => (!args.where.id || s.id === args.where.id) && ok(s.id));
        return hit ? { ...hit } : null;
      },
    };
    // course.findUnique for class insights
    this.course = {
      ...this.course,
      findUnique: async (args: any) => {
        const c = this.tables.course.find((x) => x.id === args.where.id);
        if (!c) return null;
        const lectures = this.tables.lecture.filter((l) => l.courseId === c.id);
        return {
          id: c.id, facultyId: c.facultyId,
          _count: { lectures: lectures.length },
          concepts: this.tables.concept.filter((k) => k.courseId === c.id).map((k) => ({ id: k.id, name: k.name })),
          enrollments: this.tables.enrollment.filter((e) => e.courseId === c.id).map((e) => {
            const twin = this.tables.digitalTwin.find((t) => t.studentId === e.studentId) ?? null;
            const risks = this.tables.riskAssessment.filter((r) => r.studentId === e.studentId).sort((a, b) => b.createdAt - a.createdAt);
            return {
              student: {
                id: e.studentId,
                digitalTwin: twin && { academicHealth: twin.academicHealth, attendanceScore: twin.attendanceScore, knowledgeScore: twin.knowledgeScore, performanceScore: twin.performanceScore },
                riskAssessments: risks.slice(0, 1).map((r) => ({ riskLevel: r.riskLevel })),
                attendance: this.tables.attendance.filter((a) => a.studentId === e.studentId && lectures.some((l) => l.id === a.lectureId)).map((a) => ({ status: a.status })),
              },
            };
          }),
        };
      },
    };
  }

  $transaction = async (fn: any) => (typeof fn === 'function' ? fn(this) : Promise.all(fn));
}

export function seedCourse(db: FakeDb) {
  const t = db.tables;
  t.faculty.push({ id: 'fac1' });
  t.course.push({ id: 'c1', facultyId: 'fac1', code: 'CS101', name: 'Databases' });
  for (const [sid, roll] of [['s1', '24BCE0001'], ['s2', '24BCE0002'], ['s3', '24BCE0003']]) {
    t.student.push({ id: sid, rollNumber: roll, fullName: `Student ${sid}`, department: 'CSE' });
    t.enrollment.push({ id: `e-${sid}`, studentId: sid, courseId: 'c1' });
    t.digitalTwin.push({ id: `tw-${sid}`, studentId: sid, academicHealth: 80, performanceScore: 70, attendanceScore: 100, engagementScore: 70, knowledgeScore: 70, learningVelocity: 0.5, behaviorScore: 70, skillsScore: 70 });
  }
  t.student.push({ id: 'outsider', rollNumber: '24BCE9999', fullName: 'Not Enrolled', department: 'CSE' });
  t.concept.push({ id: 'k1', courseId: 'c1', name: 'SQL Joins' }, { id: 'k2', courseId: 'c1', name: 'Normalization' });
  t.lecture.push({ id: 'L1', courseId: 'c1', date: new Date('2026-10-01T00:00:00Z'), time: '10:00', room: 'B-204', createdAt: new Date(0), updatedAt: new Date(0) });
  t.assignment.push({ id: 'A1', courseId: 'c1', title: 'ER Design', maxMarks: 20, dueDate: new Date('2026-10-10T23:59:59Z') });
  t.question.push({ id: 'qa1', assignmentId: 'A1', conceptId: 'k2', type: 'SHORT_ANSWER', correctAnswer: 'Graded by instructor' });
  t.quiz.push({ id: 'Q1', courseId: 'c1', title: 'Joins quiz', durationMins: 20 });
  t.question.push(
    { id: 'q1', quizId: 'Q1', conceptId: 'k1', type: 'MCQ', correctAnswer: 'INNER JOIN' },
    { id: 'q2', quizId: 'Q1', conceptId: 'k1', type: 'TRUE_FALSE', correctAnswer: 'True' },
    { id: 'q3', quizId: 'Q1', conceptId: 'k2', type: 'SHORT_ANSWER', correctAnswer: 'Third normal form' },
  );
  return db;
}
