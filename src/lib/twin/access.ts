import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

type Authed = Extract<Awaited<ReturnType<typeof requireRole>>, { user: unknown }>;

/** requireRole with a clean ok/error result (its own union widens `error` to possibly-undefined). */
export async function requireUser(role: 'student' | 'faculty') {
  const auth = await requireRole(role);
  if ('error' in auth && auth.error) return { ok: false, error: auth.error } as const;
  return { ok: true, user: (auth as Authed).user } as const;
}

/** The signed-in faculty member, and the course only if they own it (404 otherwise, so ids aren't probed). */
export async function requireOwnCourse(courseId: string) {
  const auth = await requireUser('faculty');
  if (!auth.ok) return { ok: false, error: auth.error } as const;
  const facultyId = auth.user.faculty?.id;
  if (!facultyId) return { ok: false, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
  const course = await prisma.course.findFirst({ where: { id: courseId, facultyId }, select: { id: true, code: true, name: true, facultyId: true } });
  if (!course) return { ok: false, error: NextResponse.json({ error: 'Course not found' }, { status: 404 }) } as const;
  return { ok: true, auth, course, facultyId } as const;
}

/** The signed-in student, only if enrolled in the course (404 otherwise). */
export async function requireEnrolledStudent(courseId: string) {
  const auth = await requireUser('student');
  if (!auth.ok) return { ok: false, error: auth.error } as const;
  const studentId = auth.user.student?.id;
  if (!studentId) return { ok: false, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
  const enrollment = await prisma.enrollment.findUnique({ where: { studentId_courseId: { studentId, courseId } }, select: { id: true } });
  if (!enrollment) return { ok: false, error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;
  return { ok: true, auth, studentId } as const;
}

export async function enrolledStudents(courseId: string) {
  const rows = await prisma.enrollment.findMany({
    where: { courseId },
    select: { student: { select: { id: true, rollNumber: true, fullName: true } } },
    orderBy: { student: { rollNumber: 'asc' } },
  });
  return rows.map((r) => r.student);
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status: 400 });
}
