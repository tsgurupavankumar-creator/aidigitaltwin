import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma, AgentType, AgentStatus, Priority } from '@prisma/client';
import { InternalPersistencePayloadSchema } from '@/lib/validation/internal-persistence';
import { assertInternalServiceToken } from '@/lib/validation/internal-service-token';

export const runtime = 'nodejs';

function response(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  try {
    assertInternalServiceToken(request.headers);
  } catch {
    return response('Unauthorized internal request', 401);
  }

  let incoming: unknown;
  try { incoming = await request.json(); }
  catch { return response('Invalid JSON', 400); }
  const parsed = InternalPersistencePayloadSchema.safeParse(incoming);
  if (!parsed.success) return response('Invalid persistence payload', 400);
  const { studentId, runId, operations, degraded } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({ where: { id: studentId }, select: { id: true } });
      if (!student) throw new Error('Student not found');
      // Prevent duplicate persistence during a client retry of the same logical run.
      const marker = await tx.agentLog.findFirst({
        where: { studentId, triggeredBy: `langgraph:${runId}`, agentType: AgentType.RISK_ASSESSMENT, status: AgentStatus.COMPLETED },
      });
      if (marker) return { applied: 0, replayed: true };

      for (const op of operations) {
        switch (op.type) {
          case 'twin_update': {
            const current = await tx.digitalTwin.findUnique({ where: { studentId } });
            const defaults = {
              academicHealth: 0, performanceScore: 0, attendanceScore: 0,
              knowledgeScore: 0, engagementScore: 0, behaviorScore: 0,
              skillsScore: 0, learningVelocity: 0,
            };
            const dimensions = { ...(current || defaults), ...op.data };
            const { academicHealth, performanceScore, attendanceScore, knowledgeScore,
              engagementScore, behaviorScore, skillsScore, learningVelocity } = dimensions;
            await tx.digitalTwin.upsert({ where: { studentId }, create: {
              studentId, academicHealth, performanceScore, attendanceScore,
              knowledgeScore, engagementScore, behaviorScore, skillsScore, learningVelocity,
            }, update: { ...op.data, lastSyncedAt: new Date() } });
            // TwinSnapshot has NOT NULL scores and requires a full dimension set.
            await tx.twinSnapshot.create({ data: {
              studentId, academicHealth, performanceScore, attendanceScore, knowledgeScore,
              engagementScore, behaviorScore, skillsScore, learningVelocity, event: 'langgraph:twin_update',
            } });
            break;
          }
          case 'snapshot': {
            const twin = await tx.digitalTwin.findUnique({ where: { studentId } });
            if (!twin) throw new Error('A digital twin must exist before capturing a snapshot');
            await tx.twinSnapshot.create({ data: {
              studentId, academicHealth: twin.academicHealth,
              performanceScore: twin.performanceScore, attendanceScore: twin.attendanceScore,
              knowledgeScore: twin.knowledgeScore, engagementScore: twin.engagementScore,
              behaviorScore: twin.behaviorScore, skillsScore: twin.skillsScore,
              learningVelocity: twin.learningVelocity,
              event: `langgraph:snapshot:${op.data.capturedAt}`,
            } });
            break;
          }
          case 'risk_assessment': {
            await tx.riskAssessment.create({ data: {
              studentId, riskLevel: op.data.riskLevel, riskScore: op.data.probability,
              confidenceScore: 0, factors: { source: 'langgraph', degraded } as Prisma.InputJsonValue,
              explanation: { rationale: op.data.rationale } as Prisma.InputJsonValue,
            } });
            break;
          }
          case 'agent_log': {
            await tx.agentLog.create({ data: {
              studentId, agentType: AgentType.RECOMMENDATION, status: AgentStatus.COMPLETED,
              input: op.data.input as Prisma.InputJsonValue,
              output: op.data.output as Prisma.InputJsonValue,
              executionTimeMs: op.data.durationMs, triggeredBy: `langgraph:${runId}:${op.data.agentName}`.slice(0, 190),
            } });
            break;
          }
          case 'study_plan': {
            const topicIds = op.data.steps.map((step) => step.syllabusTopicId);
            const topics = await tx.syllabusTopic.findMany({
              where: { id: { in: topicIds }, module: { syllabus: { studentId } } },
              select: { id: true, module: { select: { syllabusId: true } } },
            });
            const ids = new Set(topics.map((topic) => topic.id));
            const syllabi = new Set(topics.map((topic) => topic.module.syllabusId));
            if (ids.size !== new Set(topicIds).size || syllabi.size !== 1) {
              throw new Error('Study plan topics must belong to one student-owned syllabus');
            }
            await tx.studyPlan.create({ data: {
              studentId, syllabusId: topics[0].module.syllabusId,
              title: 'Personalized study plan', tasks: { create: op.data.steps.map((step) => ({
                syllabusTopicId: step.syllabusTopicId, conceptId: step.conceptId,
                title: step.title, reason: step.reason, orderIndex: step.orderIndex,
                estimatedMins: step.estimatedMinutes, priority: Priority.MEDIUM,
              })) },
            } });
            break;
          }
        }
      }
      await tx.agentLog.create({ data: {
        studentId, agentType: AgentType.RISK_ASSESSMENT, status: AgentStatus.COMPLETED,
        input: { operationCount: operations.length, runId },
        output: { applied: operations.length, degraded }, triggeredBy: `langgraph:${runId}`,
      } });
      return { applied: operations.length };
    }, { timeout: 20000 });
    return NextResponse.json(result);
  } catch (error) {
    // Failure audit is intentionally outside the rolled-back transaction.
    try {
      await prisma.agentLog.create({ data: {
        studentId, agentType: AgentType.RISK_ASSESSMENT, status: AgentStatus.FAILED,
        input: { runId, operationCount: operations.length },
        output: { reason: 'Internal persistence transaction failed' },
        triggeredBy: `langgraph:failed:${runId}`,
      } });
    } catch { console.error('[INTERNAL_PERSISTENCE] Audit write unavailable'); }
    console.error('[INTERNAL_PERSISTENCE] Transaction rejected', error instanceof Error ? error.name : 'unknown');
    return response('Persistence transaction failed', 400);
  }
}
