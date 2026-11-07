import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { simulateWhatIf, WhatIfUnavailable } from './what-if';

export const scenarioSchema = z.object({
  attendancePct: z.number().min(0).max(100).optional(),
  quizAveragePct: z.number().min(0).max(100).optional(),
  missedAssignments: z.number().int().min(0).max(100).optional(),
  lateAssignments: z.number().int().min(0).max(100).optional(),
}).refine((s) => Object.values(s).some((v) => v !== undefined), { message: 'Change at least one input.' });

/** True when the student is enrolled in at least one course this faculty member teaches. */
export async function facultyTeachesStudent(facultyId: string, studentId: string) {
  const found = await prisma.student.findFirst({
    where: { id: studentId, enrollments: { some: { course: { facultyId } } } },
    select: { id: true },
  });
  return !!found;
}

export async function whatIfResponse(requesterKey: string, studentId: string, body: unknown) {
  const limit = checkRateLimit(`what-if:${requesterKey}`, { max: 30, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) return NextResponse.json({ error: 'Too many simulations; try again shortly.' }, { status: 429 });
  const parsed = scenarioSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid scenario' }, { status: 400 });
  try {
    return NextResponse.json(await simulateWhatIf(studentId, parsed.data));
  } catch (error) {
    if (error instanceof WhatIfUnavailable) return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof Error && /fetch failed|ECONNREFUSED|ML service/i.test(error.message)) {
      return NextResponse.json({ error: 'The ML service is not reachable; start it and try again.' }, { status: 503 });
    }
    console.error('[WHAT_IF]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function historyResponse(studentId: string) {
  const rows = await prisma.twinSnapshot.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: { createdAt: true, academicHealth: true, performanceScore: true, attendanceScore: true, engagementScore: true,
      knowledgeScore: true, learningVelocity: true, behaviorScore: true, skillsScore: true, riskScore: true, riskLevel: true, event: true },
  });
  return NextResponse.json({ history: rows.reverse() });
}
