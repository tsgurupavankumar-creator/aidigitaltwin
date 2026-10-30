import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { getAuthSession } from '@/lib/auth/session';
import { isAtRiskLevel } from '@/lib/risk/at-risk';

/**
 * Real notifications for the bell.
 *  student: unread alerts (PATCH marks them read)
 *  faculty: interventions not yet completed, and students whose latest risk is high or critical
 */
export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (String(session.role).toLowerCase() === 'student') {
    const auth = await requireRole('student');
    if ('error' in auth) return auth.error;
    const alerts = await prisma.alert.findMany({ where: { studentId: auth.user.student!.id, isRead: false }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, message: true, severity: true, createdAt: true } });
    return NextResponse.json({ count: alerts.length, items: alerts.map((a) => ({ id: a.id, text: a.message, at: a.createdAt, href: '/student/alerts' })) });
  }
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;
  const facultyId = auth.user.faculty!.id;
  const [open, students] = await Promise.all([
    prisma.intervention.findMany({ where: { facultyId, completedAt: null }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, createdAt: true, student: { select: { fullName: true } } } }),
    prisma.student.findMany({ where: { enrollments: { some: { course: { facultyId } } } }, select: { id: true, fullName: true, riskAssessments: { orderBy: { createdAt: 'desc' }, take: 1, select: { riskLevel: true, createdAt: true } } } }),
  ]);
  const atRisk = students.filter((s) => isAtRiskLevel(s.riskAssessments[0]?.riskLevel));
  const items = [
    ...open.map((i) => ({ id: `int-${i.id}`, text: `Intervention for ${i.student.fullName} is waiting`, at: i.createdAt, href: '/faculty/interventions' })),
    ...atRisk.map((s) => ({ id: `risk-${s.id}`, text: `${s.fullName} is at ${s.riskAssessments[0]!.riskLevel.toLowerCase()} risk`, at: s.riskAssessments[0]!.createdAt, href: `/faculty/student/${s.id}` })),
  ];
  return NextResponse.json({ count: items.length, items });
}

/** Students: mark all their alerts as read. */
export async function PATCH(_req: NextRequest) {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;
  await prisma.alert.updateMany({ where: { studentId: auth.user.student!.id, isRead: false }, data: { isRead: true } });
  return NextResponse.json({ ok: true });
}
