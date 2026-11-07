import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
/** Lists only the authenticated student's syllabus versions per enrolled course. */
export async function GET(req: NextRequest) {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;
  if (process.env.PRACTICE_TIER_ENABLED !== 'true') return NextResponse.json({ error: 'Feature disabled' }, { status: 404 });
  const studentId = auth.user.student!.id;
  const courseId = req.nextUrl.searchParams.get('courseId') || undefined;
  const rows = await prisma.courseSyllabus.findMany({ where: { studentId, ...(courseId ? { courseId } : {}) },
    orderBy: [{ createdAt: 'desc' }], select: { id: true, courseId: true, version: true, active: true,
      parseStatus: true, createdAt: true, originalFileName: true, course: { select: { id: true, name: true, code: true } },
      modules: { select: { _count: { select: { topics: true } } } } } });
  return NextResponse.json({ syllabi: rows.map(s => ({ ...s, topicCount: s.modules.reduce((sum, m) => sum + m._count.topics, 0) })) });
}
