import { prisma } from '@/lib/prisma';
import { RecordError } from './records';
import { scheduleTwinSync } from './sync';
import { endOfDay } from './deadline';

/** Edit / delete paths for faculty, with the rules that keep student records safe. */
const resync = (studentIds: string[], event: 'attendance_marked' | 'assignment_submitted', key: string) =>
  scheduleTwinSync([...new Set(studentIds)].map((studentId) => ({ studentId, event, sourceKey: `${key}:${studentId}:${Date.now()}` })));

export async function updateLecture(courseId: string, lectureId: string, input: { date?: string; time?: string; room?: string }) {
  const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, courseId }, select: { id: true } });
  if (!lecture) throw new RecordError('Lecture not found in this course', 404);
  await prisma.lecture.update({
    where: { id: lectureId },
    data: { ...(input.date && { date: new Date(`${input.date}T00:00:00.000Z`) }), ...(input.time && { time: input.time }), ...(input.room && { room: input.room }) },
  });
}

/** Deleting a lecture deletes its attendance marks; affected twins are recomputed. */
export async function deleteLecture(courseId: string, lectureId: string) {
  const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, courseId }, select: { id: true, attendance: { select: { studentId: true } } } });
  if (!lecture) throw new RecordError('Lecture not found in this course', 404);
  await prisma.lecture.delete({ where: { id: lectureId } });
  return { removedMarks: lecture.attendance.length, twinUpdatesQueued: resync(lecture.attendance.map((a) => a.studentId), 'attendance_marked', `lecture-deleted:${lectureId}`) };
}

export async function updateAssignment(courseId: string, assignmentId: string, input: { title?: string; description?: string | null; maxMarks?: number; dueDate?: string }) {
  const a = await prisma.assignment.findFirst({
    where: { id: assignmentId, courseId },
    select: { id: true, submissions: { select: { id: true, studentId: true, status: true, marksObtained: true, submittedAt: true } } },
  });
  if (!a) throw new RecordError('Assignment not found in this course', 404);
  const highest = Math.max(0, ...a.submissions.map((s) => s.marksObtained ?? 0));
  if (input.maxMarks !== undefined && input.maxMarks < highest) throw new RecordError(`Max marks cannot be below a mark already given (${highest}).`);
  const due = input.dueDate ? endOfDay(input.dueDate) : undefined;
  await prisma.$transaction(async (tx) => {
    await tx.assignment.update({
      where: { id: assignmentId },
      data: { ...(input.title && { title: input.title }), ...(input.description !== undefined && { description: input.description }), ...(input.maxMarks !== undefined && { maxMarks: input.maxMarks }), ...(due && { dueDate: due }) },
    });
    if (due) {
      // A new due date re-labels ungraded hand-ins as on time or late.
      for (const s of a.submissions) {
        if (s.status === 'GRADED' || !s.submittedAt) continue;
        const status = s.submittedAt > due ? 'LATE' : 'SUBMITTED';
        if (status !== s.status) await tx.submission.update({ where: { id: s.id }, data: { status } });
      }
    }
  });
  const twinUpdatesQueued = due || input.maxMarks !== undefined ? resync(a.submissions.map((s) => s.studentId), 'assignment_submitted', `assignment-edited:${assignmentId}`) : 0;
  return { twinUpdatesQueued };
}

/** Refused once anything is graded (deleting would erase students' marks). */
export async function deleteAssignment(courseId: string, assignmentId: string) {
  const a = await prisma.assignment.findFirst({ where: { id: assignmentId, courseId }, select: { id: true, submissions: { select: { studentId: true, marksObtained: true } } } });
  if (!a) throw new RecordError('Assignment not found in this course', 404);
  const graded = a.submissions.filter((s) => s.marksObtained !== null).length;
  if (graded) throw new RecordError(`${graded} submission(s) are graded; deleting would erase those marks.`, 409);
  await prisma.assignment.delete({ where: { id: assignmentId } });
  return { twinUpdatesQueued: resync(a.submissions.map((s) => s.studentId), 'assignment_submitted', `assignment-deleted:${assignmentId}`) };
}

export async function updateCourse(courseId: string, input: { code?: string; name?: string; credits?: number; semester?: number; department?: string }) {
  if (input.code) {
    const clash = await prisma.course.findFirst({ where: { code: input.code, NOT: { id: courseId } }, select: { id: true } });
    if (clash) throw new RecordError(`Another course already uses the code ${input.code}.`, 409);
  }
  await prisma.course.update({ where: { id: courseId }, data: input });
}

/** Removes the student from the course; their past records stay as history. */
export async function unenroll(courseId: string, studentId: string) {
  const e = await prisma.enrollment.findUnique({ where: { studentId_courseId: { studentId, courseId } }, select: { id: true } });
  if (!e) throw new RecordError('That student is not enrolled in this course', 404);
  await prisma.enrollment.delete({ where: { id: e.id } });
  return { twinUpdatesQueued: resync([studentId], 'attendance_marked', `unenrolled:${courseId}`) };
}
