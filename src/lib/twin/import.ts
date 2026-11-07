import type { AttendanceStatus, PrismaClient } from '@prisma/client';
import { parseCsv, requireHeaders } from './csv';
import { ATTENDANCE_STATUSES, RecordError, saveAttendance, saveGrades } from './records';
import type { SyncTask } from './sync';

/**
 * Bulk import of attendance or grades for one course.
 *
 * attendance CSV: rollNumber, date (YYYY-MM-DD), status (PRESENT/ABSENT/LATE/EXCUSED
 *                 or P/A/L/E), optional time and room. Rows for a date that has
 *                 no lecture create one; if a date has several lectures, give time.
 * grades CSV:     rollNumber, assignment (exact title in this course), marks.
 *
 * Every row is checked first; any problem returns all row errors and saves
 * nothing. Valid files are saved in one transaction.
 */

export type ImportKind = 'attendance' | 'grades';
export interface RowError { row: number; message: string }

const STATUS_ALIASES: Record<string, AttendanceStatus> = { P: 'PRESENT', A: 'ABSENT', L: 'LATE', E: 'EXCUSED' };

export function parseStatus(raw: string): AttendanceStatus | null {
  const v = raw.trim().toUpperCase();
  if ((ATTENDANCE_STATUSES as string[]).includes(v)) return v as AttendanceStatus;
  return STATUS_ALIASES[v] ?? null;
}

export function parseIsoDate(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null;
}

export interface ImportResult { kind: ImportKind; rows: number; saved: number; unchanged: number; lecturesCreated: number; tasks: SyncTask[] }

export async function importCsv(prisma: PrismaClient, courseId: string, kind: ImportKind, csv: string): Promise<ImportResult> {
  let table;
  try {
    table = parseCsv(csv);
    requireHeaders(table, kind === 'attendance' ? ['rollNumber', 'date', 'status'] : ['rollNumber', 'assignment', 'marks']);
  } catch (error) {
    throw new RecordError((error as Error).message);
  }
  if (!table.rows.length) throw new RecordError('The file has a header but no rows.');

  const enrolled = await prisma.enrollment.findMany({ where: { courseId }, select: { student: { select: { id: true, rollNumber: true } } } });
  const byRoll = new Map(enrolled.map((e) => [e.student.rollNumber.toUpperCase(), e.student.id]));
  const errors: RowError[] = [];
  const studentFor = (raw: string, row: number) => {
    const id = byRoll.get(raw.trim().toUpperCase());
    if (!id) errors.push({ row, message: raw.trim() ? `Roll number ${raw.trim()} is not enrolled in this course.` : 'Missing roll number.' });
    return id;
  };

  if (kind === 'attendance') {
    const lectures = await prisma.lecture.findMany({ where: { courseId }, select: { id: true, date: true, time: true } });
    type Planned = { day: string; time: string; room: string; studentId: string; status: AttendanceStatus };
    const planned: Planned[] = [];
    table.rows.forEach((r, i) => {
      const row = i + 2;
      const studentId = studentFor(r.rollnumber, row);
      const date = parseIsoDate(r.date);
      const status = parseStatus(r.status);
      if (!date) errors.push({ row, message: `Date "${r.date}" is not YYYY-MM-DD.` });
      if (!status) errors.push({ row, message: `Status "${r.status}" must be PRESENT, ABSENT, LATE, EXCUSED (or P, A, L, E).` });
      if (studentId && date && status) planned.push({ day: date.toISOString().slice(0, 10), time: (r.time ?? '').trim(), room: (r.room ?? '').trim(), studentId, status });
    });
    // Resolve each (day, time) to one lecture.
    const slots = new Map<string, { day: string; time: string; room: string; lectureId?: string }>();
    for (const p of planned) {
      const key = `${p.day}|${p.time}`;
      if (!slots.has(key)) slots.set(key, { day: p.day, time: p.time, room: p.room });
    }
    for (const slot of slots.values()) {
      const sameDay = lectures.filter((l) => l.date.toISOString().slice(0, 10) === slot.day && (!slot.time || l.time === slot.time));
      if (sameDay.length > 1) errors.push({ row: 0, message: `${slot.day} has ${sameDay.length} lectures; add a time column to say which one.` });
      else if (sameDay.length === 1) slot.lectureId = sameDay[0].id;
    }
    const seen = new Set<string>();
    planned.forEach((p) => {
      const key = `${p.day}|${p.time}|${p.studentId}`;
      if (seen.has(key)) errors.push({ row: 0, message: `A student appears twice for ${p.day}${p.time ? ` ${p.time}` : ''}.` });
      seen.add(key);
    });
    if (errors.length) throw new RecordError(`${errors.length} problem(s) in the file; nothing was saved.`, 400, { errors: errors.slice(0, 100) });

    return prisma.$transaction(async (tx) => {
      let saved = 0, unchanged = 0, lecturesCreated = 0;
      const tasks: SyncTask[] = [];
      for (const slot of slots.values()) {
        let lectureId = slot.lectureId;
        if (!lectureId) {
          const created = await tx.lecture.create({ data: { courseId, date: new Date(`${slot.day}T00:00:00.000Z`), time: slot.time, room: slot.room }, select: { id: true } });
          lectureId = created.id;
          lecturesCreated += 1;
        }
        const records = planned.filter((p) => p.day === slot.day && p.time === slot.time).map((p) => ({ studentId: p.studentId, status: p.status }));
        const result = await saveAttendance(tx, courseId, lectureId, records);
        saved += result.saved; unchanged += result.unchanged; tasks.push(...result.tasks);
      }
      return { kind, rows: table.rows.length, saved, unchanged, lecturesCreated, tasks };
    }, { timeout: 60_000 });
  }

  // grades
  const assignments = await prisma.assignment.findMany({ where: { courseId }, select: { id: true, title: true, maxMarks: true } });
  const byTitle = new Map<string, typeof assignments>();
  for (const a of assignments) byTitle.set(a.title.trim().toLowerCase(), [...(byTitle.get(a.title.trim().toLowerCase()) ?? []), a]);
  const planned: Array<{ assignmentId: string; studentId: string; marksObtained: number }> = [];
  const seen = new Set<string>();
  table.rows.forEach((r, i) => {
    const row = i + 2;
    const studentId = studentFor(r.rollnumber, row);
    const matches = byTitle.get((r.assignment ?? '').trim().toLowerCase()) ?? [];
    if (matches.length !== 1) errors.push({ row, message: matches.length ? `Several assignments are titled "${r.assignment}".` : `No assignment titled "${r.assignment}" in this course.` });
    const marks = Number(r.marks);
    if (r.marks === '' || !Number.isFinite(marks)) errors.push({ row, message: `Marks "${r.marks}" is not a number.` });
    else if (matches.length === 1 && (marks < 0 || marks > matches[0].maxMarks)) errors.push({ row, message: `Marks must be between 0 and ${matches[0].maxMarks}.` });
    if (studentId && matches.length === 1 && Number.isFinite(marks)) {
      const key = `${matches[0].id}|${studentId}`;
      if (seen.has(key)) errors.push({ row, message: 'This student already has a row for this assignment.' });
      seen.add(key);
      planned.push({ assignmentId: matches[0].id, studentId, marksObtained: marks });
    }
  });
  if (errors.length) throw new RecordError(`${errors.length} problem(s) in the file; nothing was saved.`, 400, { errors: errors.slice(0, 100) });

  return prisma.$transaction(async (tx) => {
    let saved = 0, unchanged = 0;
    const tasks: SyncTask[] = [];
    for (const assignmentId of [...new Set(planned.map((p) => p.assignmentId))]) {
      const result = await saveGrades(tx, courseId, assignmentId, planned.filter((p) => p.assignmentId === assignmentId));
      saved += result.saved; unchanged += result.unchanged; tasks.push(...result.tasks);
    }
    return { kind, rows: table.rows.length, saved, unchanged, lecturesCreated: 0, tasks };
  }, { timeout: 60_000 });
}

