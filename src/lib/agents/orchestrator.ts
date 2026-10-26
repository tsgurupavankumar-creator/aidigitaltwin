import { prisma } from '@/lib/prisma';
import {
  ActionType,
  AlertSeverity,
  AlertType,
  AgentType as PrismaAgentType,
  InterventionType,
  RiskLevel,
} from '@prisma/client';
import { runAttendanceRisk } from './attendance-risk';
import { runKnowledgeGap } from './knowledge-gap';
import { runLearningAnalysis } from './learning-analysis';
import type { Prisma } from '@prisma/client';
import { computeRiskAssessment } from './risk-scoring';
import { loadRiskConfig } from './risk-config';
import { proposeLearningPlan, type LLMPlanResult } from './llm-learning-plan';
import { refreshCourseInsight } from '@/lib/twin/class-insights';
import { computeTwinDimensions } from '@/lib/twin/dimensions';
import { loadDimensionInputs } from '@/lib/twin/dimension-inputs';
import type { AgentError, AgentResult, AttendancePrediction, KnowledgeGapPrediction, LearningPrediction, Intervention, OrchestrationResult, StudentEvent } from './types';

const actionForFlag: Record<string, string> = {
  ATTENDANCE: 'Attend the next three scheduled sessions and contact faculty if support is needed.',
  PERFORMANCE: 'Schedule a focused revision block for the weakest recent concepts.',
  KNOWLEDGE: 'Complete a targeted practice set for the identified prerequisite gaps.',
};

// Decision logic: the event determines the minimum relevant agents, while a
// low attendance score can add the attendance monitor even for another event.

export async function hasLearningEvidence(studentId: string): Promise<boolean> {
  const [quizzes, graded] = await Promise.all([
    prisma.quizAttempt.count({ where: { studentId } }),
    prisma.submission.count({ where: { studentId, marksObtained: { not: null } } }),
  ]);
  return quizzes + graded > 0;
}

function selectAgents(event: StudentEvent, attendanceScore: number) {
  const selected = new Set<string>();
  if (event === 'quiz_attempted' || event === 'assignment_submitted') {
    selected.add('learning');
    selected.add('knowledge');
  }
  if (event === 'attendance_marked') selected.add('attendance');
  if (event === 'weekly_review' || event === 'manual_trigger') {
    selected.add('learning');
    selected.add('attendance');
    selected.add('knowledge');
  }
  if (attendanceScore < 75) selected.add('attendance');
  return [...selected];
}

// Decision logic: intervention flags are derived only from agent predictions
// and confidence thresholds; multiple independent flags raise severity and
// can escalate the case to faculty.

function decideIntervention(results: AgentResult[], studentId: string, degraded = false): Intervention {
  const flags = new Set<string>();
  for (const result of results) {
    if (result.agentType === 'ATTENDANCE_RISK' && 'atRisk' in result.prediction && result.prediction.atRisk) flags.add('ATTENDANCE');
    if (result.agentType === 'LEARNING_ANALYSIS' && 'trend' in result.prediction && result.prediction.trend === 'DOWN' && result.confidence >= 0.7) flags.add('PERFORMANCE');
    if (result.agentType === 'KNOWLEDGE_GAP' && 'overallGapScore' in result.prediction && result.prediction.overallGapScore > 60) flags.add('KNOWLEDGE');
  }
  const flagList = [...flags];
  // Severity is driven purely by how many independent domains are flagged,
  // not by how badly any single one is flagged: ATTENDANCE, PERFORMANCE and
  // KNOWLEDGE are treated as three separate signals, and a student tripping
  // two or more at once is judged more urgent than one severe flag alone,
  // since it suggests the problem isn't isolated to one course or habit.
  //   0 flags  -> LOW    (no domain currently flagged)
  //   1 flag   -> MEDIUM (a single concerning signal — worth a recommendation)
  //   2+ flags -> HIGH   (multiple independent signals — escalates to faculty,
  //                       see shouldEscalateToFaculty below)
  const severity = flagList.length >= 2 ? 'HIGH' : flagList.length === 1 ? 'MEDIUM' : 'LOW';
  return {
    flags: flagList,
    severity,
    studentId,
    recommendedActions: flagList.length
      ? flagList.map((flag) => actionForFlag[flag])
      : [
          degraded
            ? 'One or more analysis agents did not complete, so no recommendation can be made yet. Re-run the review once they are available.'
            : 'Continue the current learning routine and complete the next scheduled assessment.',
        ],
    // A degraded run persists nothing, so it never actually escalates.
    shouldEscalateToFaculty: severity === 'HIGH' && !degraded,
    triggeredAt: new Date(),
  };
}

// Persistence: convert agent findings into durable Alerts and Recommendations
// and, only for high-severity cases, a faculty Intervention linked to the
// student's enrolled department.

async function persistIntervention(
  studentId: string,
  intervention: Intervention,
  results: AgentResult[],
  llmPlan: LLMPlanResult | null,
  tx: Prisma.TransactionClient = prisma
) {
  // Nothing real to base a recommendation's confidence on without agent results.
  if (results.length === 0) return undefined;

  const student = await tx.student.findUnique({ where: { id: studentId }, select: { department: true } });
  if (!student) throw new Error('Student not found while persisting intervention');

  const alertMessages: Array<{ type: AlertType; message: string }> = [];
  if (intervention.flags.includes('ATTENDANCE')) {
    alertMessages.push({ type: AlertType.ATTENDANCE, message: results.find((result) => result.agentType === 'ATTENDANCE_RISK')?.reasoning || 'Attendance risk detected.' });
  }
  if (intervention.flags.includes('PERFORMANCE')) {
    alertMessages.push({ type: AlertType.QUIZ, message: results.find((result) => result.agentType === 'LEARNING_ANALYSIS')?.reasoning || 'Learning performance trend requires attention.' });
  }
  if (intervention.flags.includes('KNOWLEDGE')) {
    alertMessages.push({ type: AlertType.RECOMMENDATION, message: results.find((result) => result.agentType === 'KNOWLEDGE_GAP')?.recommendedAction || 'Knowledge gaps require targeted practice.' });
  }
  for (const alert of alertMessages) {
    await tx.alert.create({
      data: {
        studentId,
        type: alert.type,
        severity: intervention.severity === 'HIGH' ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
        message: alert.message,
      },
    });
  }

  if (llmPlan) {
    await tx.studyPlan.create({
      data: {
        studentId,
        title: `AI Tutor Plan: ${llmPlan.plan.actionType.toLowerCase()}`,
        tasks: {
          create: llmPlan.plan.tasks.map((task) => ({
            conceptId: task.conceptId,
            priority: task.priority,
            estimatedMins: task.estimatedMins,
          })),
        },
      },
    });
    for (const task of llmPlan.plan.tasks) {
      await tx.recommendation.create({
        data: {
          studentId,
          agentType: PrismaAgentType.RECOMMENDATION,
          title: `${task.title} (${task.reason})`.slice(0, 500),
          actionType: ActionType[llmPlan.plan.actionType],
          confidence: Math.max(...results.map((result) => result.confidence)),
        },
      });
    }
  } else {
    for (const action of intervention.recommendedActions) {
      await tx.recommendation.create({
        data: {
          studentId,
          agentType: PrismaAgentType.RECOMMENDATION,
          title: action,
          actionType: intervention.flags.includes('ATTENDANCE') ? ActionType.REVIEW : ActionType.PRACTICE,
          // Use the highest real agent confidence; never floor it artificially.
          confidence: Math.max(...results.map((result) => result.confidence)),
        },
      });
    }
  }

  if (!intervention.shouldEscalateToFaculty) return undefined;
  const faculty = await tx.faculty.findFirst({
    where: {
      department: student.department,
      user: { status: 'ACTIVE' },
      courses: { some: { enrollments: { some: { studentId } } } },
    },
    select: { id: true },
  });
  if (!faculty) return undefined;

  const ruleBasedType = intervention.flags.includes('ATTENDANCE')
    ? InterventionType.COUNSELING
    : intervention.flags.includes('PERFORMANCE')
      ? InterventionType.TUTORING
      : InterventionType.QUIZ;
  const type = llmPlan?.plan.facultyAction && llmPlan.plan.facultyAction !== 'NONE'
    ? InterventionType[llmPlan.plan.facultyAction]
    : ruleBasedType;
  const notes = [
    llmPlan?.plan.facultyNote,
    ...intervention.recommendedActions,
  ].filter(Boolean).join(' ').slice(0, 2000);
  const persisted = await tx.intervention.create({
    data: { facultyId: faculty.id, studentId, type, notes },
    select: { id: true },
  });
  return persisted.id;
}

export interface OrchestrateOptions {
  /**
   * Identifies the data change that triggered this run, e.g.
   * `attendance:<recordId>:<updatedAt>`. When given, the duplicate guard keys
   * on it instead of the clock hour: re-delivering the same change is
   * replayed, but every new change runs, even several in one hour (marking
   * two lectures, grading two assignments). Manual and scheduled runs omit it
   * and keep the hourly bucket.
   */
  sourceKey?: string;
  /** Batch sync refreshes each affected course once after all student runs finish. */
  skipCourseInsightRefresh?: boolean;
}

export async function orchestrate(studentId: string, event: StudentEvent, options: OrchestrateOptions = {}): Promise<OrchestrationResult> {
  // Idempotency guard: studentId + event, bucketed to the current UTC hour.
  // If orchestrate() already COMPLETED for this exact combination within this
  // hour, return that prior outcome instead of re-running every agent and
  // re-persisting a second set of Alert / Recommendation / Intervention rows
  // for what is very likely the same trigger (a retry, a duplicate delivery, a
  // double click). Replays are marked with `replayed: true`.
  //
  // Only FULLY successful runs are recorded (see the marker write at the end).
  // A degraded run (an agent failed) writes no marker, so a retry re-runs
  // instead of being served a stale, incomplete answer for the rest of the hour.
  //
  // This is an application-level check, not a database constraint: the schema
  // has no unique index for it and schema.prisma changes go through Guru Pavan.
  // Two truly simultaneous calls can both see "no marker yet" and both proceed.
  const hourBucket = new Date().toISOString().slice(0, 13); // e.g. "2026-09-21T14"
  const idempotencyKey = options.sourceKey
    ? `orchestrate:${studentId}:${event}:src:${options.sourceKey}`.slice(0, 190)
    : `orchestrate:${studentId}:${event}:${hourBucket}`;

  const existingRun = await prisma.agentLog.findFirst({
    where: {
      studentId,
      agentType: PrismaAgentType.RISK_ASSESSMENT,
      triggeredBy: idempotencyKey,
      status: 'COMPLETED',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existingRun && existingRun.output) {
    return { ...(existingRun.output as unknown as OrchestrationResult), replayed: true };
  }

  const twin = await prisma.digitalTwin.findUnique({ where: { studentId } });
  if (!twin) throw new Error('Digital twin not found for student');

  let selected = selectAgents(event, twin.attendanceScore);
  // No scored work yet: the learning model has nothing valid to predict from
  // (training needed at least one earlier score). Skip it rather than feed it
  // zeros; the risk score already re-weights when the learning term is absent.
  if (selected.includes('learning') && !(await hasLearningEvidence(studentId))) {
    selected = selected.filter((agent) => agent !== 'learning');
  }
  const outcomes = await Promise.all(
    selected.map(async (agent) => {
      try {
        const result =
          agent === 'learning'
            ? await runLearningAnalysis(studentId, event)
            : agent === 'attendance'
            ? await runAttendanceRisk(studentId, event)
            : await runKnowledgeGap(studentId, event);
        return { agent, result };
      } catch (error) {
        return { agent, error };
      }
    })
  );
  const results: AgentResult[] = outcomes.flatMap((outcome) =>
    'result' in outcome && outcome.result ? [outcome.result] : []
  );
  const agentErrors: AgentError[] = outcomes.flatMap((outcome) =>
    'error' in outcome
      ? [{ agent: outcome.agent, message: outcome.error instanceof Error ? outcome.error.message : String(outcome.error) }]
      : []
  );

  // Degraded run: at least one agent that was supposed to run did not produce a
  // result (for example the ML service is down or has no trained model).
  // Previously the error was swallowed and the run carried on, writing a risk
  // assessment padded with invented numbers. Now it is reported and NOTHING is
  // persisted by the orchestrator: no alerts, recommendations, interventions,
  // risk assessment, health update, or idempotency marker. Each agent still
  // writes its own AgentLog row (COMPLETED or FAILED) as an audit trail.
  if (agentErrors.length > 0) {
    console.error('[ORCHESTRATOR] Degraded run - nothing was persisted.', { studentId, event, agentErrors });
    return {
      results,
      intervention: decideIntervention(results, studentId, true),
      executedAt: new Date(),
      degraded: true,
      agentErrors,
    };
  }

  const gapPred = results.find((r) => r.agentType === 'KNOWLEDGE_GAP')?.prediction as KnowledgeGapPrediction | undefined;
  const attPred = results.find((r) => r.agentType === 'ATTENDANCE_RISK')?.prediction as AttendancePrediction | undefined;
  const learnPred = results.find((r) => r.agentType === 'LEARNING_ANALYSIS')?.prediction as LearningPrediction | undefined;
  const intervention = decideIntervention(results, studentId);

  // Risk remains a deterministic result of the numeric predictors and rules.
  const riskConfig = loadRiskConfig();
  const assessment = computeRiskAssessment({
    attendance: attPred,
    knowledge: gapPred,
    learning: learnPred,
    twin: { attendanceScore: twin.attendanceScore, knowledgeScore: twin.knowledgeScore },
    confidences: results.map((r) => r.confidence),
    config: riskConfig,
  });

  let llmPlan: LLMPlanResult | null = null;
  let llmFailureReason: string | undefined;
  try {
    llmPlan = await proposeLearningPlan({
      learning: learnPred,
      attendance: attPred,
      knowledge: gapPred,
      riskLevel: assessment.riskLevel,
    });
  } catch (error) {
    llmFailureReason = error instanceof Error ? error.message.slice(0, 160) : 'provider_error';
    console.error('[ORCHESTRATOR] LLM action-plan generation failed; using rule-based recommendations.', {
      studentId,
      reason: llmFailureReason,
    });
  }
  if (llmPlan) {
    intervention.recommendedActions = llmPlan.plan.tasks.map((task) => task.title);
  }

  // The four non-predicted twin dimensions, from the student's own records (null = no data: keep the old value).
  const dims = computeTwinDimensions(await loadDimensionInputs(studentId));

  let snapshot: Prisma.TwinSnapshotUncheckedCreateInput | null = null;
  const transactionResult = await prisma.$transaction(async (tx) => {
    const persistedInterventionId = await persistIntervention(studentId, intervention, results, llmPlan, tx);
    await tx.riskAssessment.create({
      data: {
        studentId,
        riskLevel: RiskLevel[assessment.riskLevel],
        riskScore: assessment.riskScore,
        predictedGPA: assessment.predictedGPA,
        confidenceScore: assessment.confidenceScore,
        factors: { ...assessment.factors, flags: intervention.flags },
        explanation: {
          summary: `Evaluated by ${results.length} multi-agent monitors. Severity: ${intervention.severity}. Flags: ${intervention.flags.join(', ') || 'None'}.`,
          flags: intervention.flags,
          riskReasons: attPred?.reasons ?? [],
          learningReasons: learnPred?.reasons ?? [],
          predictedRange: learnPred?.range ?? null,
          models: {
            earlyWarning: attPred?.modelVersion ?? null,
            learning: learnPred?.modelVersion ?? null,
            riskLevels: riskConfig?.generatedAt ? `calibrated ${riskConfig.generatedAt}` : 'hand-set defaults',
          },
        } as unknown as Prisma.InputJsonValue,
      },
    });

    const twinState = {
      academicHealth: Math.max(20, Math.min(100, 100 - assessment.riskScore)),
      performanceScore: learnPred ? Math.round(learnPred.nextExamScore) : twin.performanceScore,
      attendanceScore: attPred ? Math.round(attPred.currentAttendance) : twin.attendanceScore,
      knowledgeScore: gapPred ? Math.round(100 - gapPred.overallGapScore) : twin.knowledgeScore,
      engagementScore: dims.engagementScore ?? twin.engagementScore,
      behaviorScore: dims.behaviorScore ?? twin.behaviorScore,
      skillsScore: dims.skillsScore ?? twin.skillsScore,
      learningVelocity: dims.learningVelocity ?? twin.learningVelocity,
    };
    await tx.digitalTwin.update({
      where: { studentId },
      data: { ...twinState, lastSyncedAt: new Date() },
    });
    snapshot = { studentId, ...twinState, riskScore: assessment.riskScore, riskLevel: assessment.riskLevel, event };

    if (llmFailureReason) {
      await tx.agentLog.create({
        data: {
          studentId,
          agentType: PrismaAgentType.RECOMMENDATION,
          status: 'FAILED',
          input: { event, promptVersion: 'academic-plan-v2', riskLevel: assessment.riskLevel },
          output: {
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            degraded: true,
            reason: llmFailureReason,
            fallback: 'rule_based',
          },
          triggeredBy: `llm:${idempotencyKey}`.slice(0, 190),
        },
      });
    } else if (llmPlan) {
      await tx.agentLog.create({
        data: {
          studentId,
          agentType: PrismaAgentType.RECOMMENDATION,
          status: 'COMPLETED',
          input: { event, promptVersion: llmPlan.audit.promptVersion, riskLevel: assessment.riskLevel },
          output: {
            actionType: llmPlan.plan.actionType,
            facultyAction: llmPlan.plan.facultyAction,
            tasks: llmPlan.plan.tasks,
          },
          confidence: Math.max(...results.map((result) => result.confidence)),
          triggeredBy: `llm:${idempotencyKey}`.slice(0, 190),
        },
      });
    }
    const result: OrchestrationResult = {
      results,
      intervention,
      persistedInterventionId,
      executedAt: new Date(),
      // `degraded` keeps one meaning everywhere (sync engine, weekly review, UI): an
      // agent failed and NOTHING was saved. This run was saved; an LLM fallback is
      // reported separately in `llm` (rule-based recommendations were used).
      llm: {
        enabled: process.env.LLM_ENABLED === 'true',
        used: llmPlan !== null,
        degraded: !!llmFailureReason,
        audit: llmPlan?.audit ?? {
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          promptVersion: 'academic-plan-v2',
          outcome: llmFailureReason || (process.env.LLM_ENABLED === 'true' ? 'insufficient_evidence' : 'disabled'),
          itemCount: 0,
        },
      },
    };
    // The marker is committed atomically with all writes; it cannot claim a
    // successful run if any recommendation/risk/twin write rolls back.
    await tx.agentLog.create({
      data: {
        studentId,
        agentType: PrismaAgentType.RISK_ASSESSMENT,
        status: 'COMPLETED',
        input: { studentId, event, hourBucket },
        output: result as unknown as object,
        confidence: assessment.confidenceScore,
        triggeredBy: idempotencyKey,
      },
    });
    return result;
  }, { timeout: 20000 });

  // Twin history: one snapshot per completed run, written right after the twin update. Kept outside the
  // transaction on purpose: if the twin_snapshots table has not been created yet (migration not applied),
  // the twin must still update; only the history point is skipped, with a clear log line.
  if (snapshot) {
    try {
      await prisma.twinSnapshot.create({ data: snapshot });
    } catch (error) {
      console.warn('[TWIN_HISTORY] snapshot not saved (if twin_snapshots does not exist, run `npx prisma migrate deploy`):',
        error instanceof Error ? error.message.slice(0, 160) : error);
    }
  }
  const orchestrationResult: OrchestrationResult = transactionResult;

  // Class insights are a secondary projection. Refresh after the core writes
  // commit so an insight failure cannot roll back the student's completed run.
  if (!options.skipCourseInsightRefresh) {
    try {
      const enrollments = await prisma.enrollment.findMany({ where: { studentId }, select: { courseId: true } });
      const courseIds = [...new Set(enrollments.map((row) => row.courseId))];
      const insightResults = await Promise.allSettled(courseIds.map((courseId) => refreshCourseInsight(prisma, courseId)));
      const failedInsights = insightResults.filter((result) => result.status === 'rejected').length;
      if (failedInsights) console.warn('[ORCHESTRATOR] Class insight refresh failed for some courses.', { failedInsights });
    } catch (error) {
      console.warn('[ORCHESTRATOR] Class insight refresh was skipped after the core run committed.', error);
    }
  }

  return orchestrationResult;
}
