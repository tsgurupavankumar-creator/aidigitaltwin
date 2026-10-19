import { AgentType as PrismaAgentType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { predictLearning } from '@/lib/ml/client';
import type { AgentResult, LearningPrediction } from './types';
import { buildLearningFeatures } from './learning-features';
import { loadAssessedWork } from './assessed-work';


export async function runLearningAnalysis(studentId: string, triggeredBy = 'manual_trigger'): Promise<AgentResult> {
  const startedAt = Date.now();
  const [masteries, work, attendance] = await Promise.all([
    prisma.conceptMastery.findMany({ where: { studentId }, include: { concept: true } }),
    loadAssessedWork(studentId),
    prisma.attendance.findMany({ where: { studentId }, orderBy: { createdAt: 'asc' }, select: { status: true } }),
  ]);

  // Reasoning: the model input is built exactly as in training
  // (learning-features.ts); concept mastery only names weak/strong concepts.
  const built = buildLearningFeatures(work, attendance.map((a) => a.status));
  if (!built) {
    // The orchestrator does not select this agent for students with no scored
    // work (see hasLearningEvidence); reaching here means a direct call.
    throw new Error(`No scored quizzes or graded assignments for studentId=${studentId}; nothing to predict from.`);
  }
  const features: Record<string, number | null> = { ...built };
  const { avgQuizScore } = built;

  let result: AgentResult;
  try {
    const model = await predictLearning(studentId, features);
    if (model.modelUsed !== 'trained') {
      // A fallback prediction is a hand-written heuristic, not a real
      // model output — callers (including this agent's own consumers,
      // like the orchestrator) must never mistake it for a genuine
      // prediction. Throwing here routes into the catch block below,
      // which logs a FAILED AgentLog entry rather than silently
      // persisting a guess as if it were trustworthy.
      throw new Error(
        `Learning analysis ML service returned a fallback prediction (no trained model loaded) for studentId=${studentId}. Refusing to use an untrained prediction.`
      );
    }
    const nextExamScore = Math.max(0, Math.min(100, model.nextExamScore));
    const trend = nextExamScore > avgQuizScore + 3 ? 'UP' : nextExamScore < avgQuizScore - 3 ? 'DOWN' : 'STABLE';
    const weak = [...masteries].sort((a, b) => a.masteryScore - b.masteryScore).slice(0, 3).map((mastery) => mastery.concept.name);
    const strong = [...masteries].sort((a, b) => b.masteryScore - a.masteryScore).slice(0, 3).map((mastery) => mastery.concept.name);
    const prediction: LearningPrediction = {
      nextExamScore,
      range: model.low != null && model.high != null ? { low: model.low, high: model.high } : null,
      reasons: model.reasons ?? [],
      modelVersion: model.modelVersion ?? null,
      modelUsed: model.modelUsed,
      trend,
      confidence: Math.max(0, Math.min(1, model.confidence)),
      topWeakConcepts: weak,
      topStrongConcepts: strong,
    };

    result = {
      agentType: 'LEARNING_ANALYSIS',
      studentId,
      prediction,
      reasoning: `${model.modelUsed === 'trained' ? 'The trained model' : 'An untrained fallback heuristic (no trained model available yet)'} used ${work.quizScoresNewestFirst.length} quiz attempts, ${work.gradedScoresNewestFirst.length} graded assignments (${work.lateCount} late, ${work.missedCount} missed) and ${masteries.length} mastery records. The predicted next score is about ${nextExamScore.toFixed(0)}%${model.low != null && model.high != null ? ` (likely ${model.low.toFixed(0)}-${model.high.toFixed(0)}%)` : ''}.`,
      recommendedAction: weak.length ? `Review ${weak.slice(0, 2).join(' and ')} before the next assessment.` : 'Continue the current study routine and complete another assessment.',
      confidence: prediction.confidence,
      executedAt: new Date(),
    };

    // Persistence: every completed prediction is written to AgentLog with
    // its input features, confidence, trigger, and execution time so the UI
    // and audit trail can explain what the agent actually used.
    await prisma.agentLog.create({
      data: {
        studentId,
        agentType: PrismaAgentType.QUIZ,
        status: 'COMPLETED',
        input: { studentId, features, triggeredBy },
        output: result as unknown as object,
        confidence: result.confidence,
        triggeredBy,
        executionTimeMs: Date.now() - startedAt,
      },
    });
    return result;
  } catch (error) {
    await prisma.agentLog.create({
      data: {
        studentId,
        agentType: PrismaAgentType.QUIZ,
        status: 'FAILED',
        input: { studentId, features, triggeredBy },
        output: { error: error instanceof Error ? error.message : 'Learning model failed' },
        triggeredBy,
        executionTimeMs: Date.now() - startedAt,
      },
    });
    throw error;
  }
}
