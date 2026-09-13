import { AgentType as PrismaAgentType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { predictLearning } from '@/lib/ml/client';
import type { AgentResult, LearningPrediction } from './types';

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export async function runLearningAnalysis(studentId: string, triggeredBy = 'manual_trigger'): Promise<AgentResult> {
  const startedAt = Date.now();
  const [masteries, quizAttempts, submissions] = await Promise.all([
    prisma.conceptMastery.findMany({ where: { studentId }, include: { concept: true } }),
    prisma.quizAttempt.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.submission.findMany({ where: { studentId }, include: { assignment: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);

  const quizScores = quizAttempts.map((attempt) => attempt.percentage);
  const submissionScores = submissions
    .map((submission) => submission.marksObtained)
    .filter((score): score is number => score !== null);
  const avgMastery = average(masteries.map((mastery) => mastery.masteryScore));
  const avgQuizScore = average(quizScores);
  const avgSubmissionScore = average(submissionScores);
  const quizTrend = quizScores.length > 1 ? quizScores[0] - quizScores[quizScores.length - 1] : 0;
  const features = {
    avgMastery,
    avgQuizScore,
    avgSubmissionScore,
    quizCount: quizAttempts.length,
    submissionCount: submissions.length,
    quizTrend,
  };

  let result: AgentResult;
  try {
    const model = await predictLearning(studentId, features);
    const nextExamScore = Math.max(0, Math.min(100, model.nextExamScore));
    const trend = nextExamScore > avgQuizScore + 3 ? 'UP' : nextExamScore < avgQuizScore - 3 ? 'DOWN' : 'STABLE';
    const weak = [...masteries].sort((a, b) => a.masteryScore - b.masteryScore).slice(0, 3).map((mastery) => mastery.concept.name);
    const strong = [...masteries].sort((a, b) => b.masteryScore - a.masteryScore).slice(0, 3).map((mastery) => mastery.concept.name);
    const prediction: LearningPrediction = {
      nextExamScore,
      trend,
      confidence: Math.max(0, Math.min(1, model.confidence)),
      topWeakConcepts: weak,
      topStrongConcepts: strong,
    };

    result = {
      agentType: 'LEARNING_ANALYSIS',
      studentId,
      prediction,
      reasoning: `The model used ${quizAttempts.length} quiz attempts, ${submissions.length} submissions, and ${masteries.length} mastery records. The predicted next-exam score is ${nextExamScore.toFixed(1)}%.`,
      recommendedAction: weak.length ? `Review ${weak.slice(0, 2).join(' and ')} before the next assessment.` : 'Continue the current study routine and complete another assessment.',
      confidence: prediction.confidence,
      executedAt: new Date(),
    };

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
