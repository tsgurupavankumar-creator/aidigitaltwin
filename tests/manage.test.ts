import test from 'node:test';
import assert from 'node:assert/strict';

function stub(path: string, exports: object) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports, children: [], paths: [], path: '' } as unknown as NodeJS.Module;
}
const t = {
  lecture: [] as any[], attendance: [] as any[], assignment: [] as any[], submission: [] as any[], course: [] as any[], enrollment: [] as any[],
  synced: [] as string[],
};
const fake: any = {
  lecture: {
    findFirst: async ({ where }: any) => { const l = t.lecture.find((x) => x.id === where.id && x.courseId === where.courseId); return l ? { id: l.id, attendance: t.attendance.filter((a) => a.lectureId === l.id) } : null; },
    update: async ({ where, data }: any) => Object.assign(t.lecture.find((x) => x.id === where.id), data),
    delete: async ({ where }: any) => { t.lecture = t.lecture.filter((x) => x.id !== where.id); t.attendance = t.attendance.filter((a) => a.lectureId !== where.id); },
  },
  assignment: {
    findFirst: async ({ where }: any) => { const a = t.assignment.find((x) => x.id === where.id && x.courseId === where.courseId); return a ? { id: a.id, submissions: t.submission.filter((s) => s.assignmentId === a.id) } : null; },
    update: async ({ where, data }: any) => Object.assign(t.assignment.find((x) => x.id === where.id), data),
    delete: async ({ where }: any) => { t.assignment = t.assignment.filter((x) => x.id !== where.id); },
  },
  submission: { update: async ({ where, data }: any) => Object.assign(t.submission.find((x) => x.id === where.id), data) },
  course: {
    findFirst: async ({ where }: any) => t.course.find((c) => c.code === where.code && c.id !== where.NOT.id) ?? null,
    update: async ({ where, data }: any) => Object.assign(t.course.find((c) => c.id === where.id), data),
  },
  enrollment: {
    findUnique: async ({ where }: any) => t.enrollment.find((e) => e.studentId === where.studentId_courseId.studentId && e.courseId === where.studentId_courseId.courseId) ?? null,
    delete: async ({ where }: any) => { t.enrollment = t.enrollment.filter((e) => e.id !== where.id); },
  },
  $transaction: async (fn: any) => fn(fake),
};
stub('../src/lib/prisma', { prisma: fake, default: fake });
stub('../src/lib/twin/sync', { scheduleTwinSync: (tasks: Array<{ studentId: string }>) => { t.synced.push(...tasks.map((x) => x.studentId)); return tasks.length; } });
// eslint-disable-next-line @typescript-eslint/no-var-requires
const m = require('../src/lib/twin/manage') as typeof import('../src/lib/twin/manage');

test('deleting a lecture removes its marks, says how many, and recomputes those twins', async () => {
  t.lecture = [{ id: 'L1', courseId: 'c1' }]; t.attendance = [{ lectureId: 'L1', studentId: 's1' }, { lectureId: 'L1', studentId: 's2' }]; t.synced = [];
  const r = await m.deleteLecture('c1', 'L1');
  assert.deepEqual([r.removedMarks, r.twinUpdatesQueued], [2, 2]);
  assert.equal(t.attendance.length, 0);
  await assert.rejects(m.deleteLecture('other-course', 'L1'), /not found/);
});

test('a graded assignment cannot be deleted; max marks cannot drop below a given mark', async () => {
  t.assignment = [{ id: 'A1', courseId: 'c1', maxMarks: 20 }];
  t.submission = [{ id: 'x1', assignmentId: 'A1', studentId: 's1', status: 'GRADED', marksObtained: 18, submittedAt: new Date('2026-08-01T00:00:00Z') }];
  await assert.rejects(m.deleteAssignment('c1', 'A1'), /graded/);
  await assert.rejects(m.updateAssignment('c1', 'A1', { maxMarks: 15 }), /below a mark already given \(18\)/);
  await m.updateAssignment('c1', 'A1', { maxMarks: 25 });
  assert.equal(t.assignment[0].maxMarks, 25);
});

test('a new due date re-labels ungraded hand-ins as on time or late (India time)', async () => {
  t.assignment = [{ id: 'A2', courseId: 'c1', maxMarks: 10 }];
  t.submission = [
    { id: 'y1', assignmentId: 'A2', studentId: 's1', status: 'LATE', marksObtained: null, submittedAt: new Date('2026-08-08T20:00:00+05:30') },
    { id: 'y2', assignmentId: 'A2', studentId: 's2', status: 'SUBMITTED', marksObtained: null, submittedAt: new Date('2026-08-09T01:00:00+05:30') },
    { id: 'y3', assignmentId: 'A2', studentId: 's3', status: 'GRADED', marksObtained: 7, submittedAt: new Date('2026-08-10T01:00:00+05:30') },
  ];
  await m.updateAssignment('c1', 'A2', { dueDate: '2026-08-08' });
  assert.deepEqual(t.submission.map((s) => s.status), ['SUBMITTED', 'LATE', 'GRADED'], 'graded work is never re-labelled');
});

test('course codes stay unique; removing a student keeps their records and recomputes the twin', async () => {
  t.course = [{ id: 'c1', code: 'CS301' }, { id: 'c2', code: 'CS302' }];
  await assert.rejects(m.updateCourse('c1', { code: 'CS302' }), /already uses/);
  await m.updateCourse('c1', { name: 'Databases' });
  assert.equal(t.course[0].name, 'Databases');
  t.enrollment = [{ id: 'e1', studentId: 's1', courseId: 'c1' }]; t.attendance = [{ lectureId: 'L9', studentId: 's1' }]; t.synced = [];
  await m.unenroll('c1', 's1');
  assert.equal(t.enrollment.length, 0);
  assert.equal(t.attendance.length, 1, 'their attendance history is kept');
  assert.deepEqual(t.synced, ['s1']);
  await assert.rejects(m.unenroll('c1', 's1'), /not enrolled/);
});
