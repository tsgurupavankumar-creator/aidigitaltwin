import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

interface AgentGap { conceptId: string; conceptName: string; mastery: number; rootCause: string; impact: 'HIGH' | 'MEDIUM' | 'LOW'; downstreamConcepts: string[] }

/**
 * Concepts below 70% mastery, with the knowledge-gap agent's analysis from its latest run:
 * root cause (a weaker prerequisite), impact, and which concepts depend on it. `assessed` tells
 * "no gaps" apart from "nothing assessed yet".
 */
export async function GET() {
  const auth = await requireRole('student'); if ('error' in auth) return auth.error;
  const studentId = auth.user.student!.id;
  const [weak, assessed, log] = await Promise.all([
    prisma.conceptMastery.findMany({
      where: { studentId, masteryScore: { lt: 70 }, assessmentCount: { gt: 0 } },
      include: { concept: { select: { id: true, name: true, difficulty: true, courseId: true, course: { select: { code: true, name: true } } } } },
      orderBy: { masteryScore: 'asc' },
    }),
    prisma.conceptMastery.count({ where: { studentId, assessmentCount: { gt: 0 } } }),
    prisma.agentLog.findFirst({ where: { studentId, agentType: 'CONCEPT_MASTERY', status: 'COMPLETED' }, orderBy: { createdAt: 'desc' }, select: { output: true, createdAt: true } }),
  ]);
  const gaps = ((log?.output as { prediction?: { criticalGaps?: AgentGap[] } } | null)?.prediction?.criticalGaps ?? []);
  const byConcept = new Map(gaps.map((g) => [g.conceptId, g]));
  return NextResponse.json({
    assessed,
    analysedAt: log?.createdAt ?? null,
    data: weak.map((m) => {
      const g = byConcept.get(m.conceptId);
      return {
        ...m,
        course: m.concept.course,
        impact: g?.impact ?? null,
        rootCause: g && g.rootCause && g.rootCause !== g.conceptName ? g.rootCause : null,
        downstreamConcepts: g?.downstreamConcepts ?? [],
      };
    }),
  });
}
