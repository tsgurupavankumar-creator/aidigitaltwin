import { AgentType as PrismaAgentType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { AgentResult, KnowledgeGap, KnowledgeGapPrediction } from './types';

export async function runKnowledgeGap(studentId: string, triggeredBy = 'manual_trigger'): Promise<AgentResult> {
  const startedAt = Date.now();
  const masteries = await prisma.conceptMastery.findMany({ where: { studentId }, include: { concept: true } });
  const edges = await prisma.conceptEdge.findMany({
    where: { relationship: 'PREREQUISITE' },
    include: { prerequisite: true, dependent: true },
  });
  const masteryByConcept = new Map(masteries.map((mastery) => [mastery.conceptId, mastery]));
  const dependentMap = new Map<string, string[]>();
  for (const edge of edges) {
    const dependents = dependentMap.get(edge.prerequisiteId) || [];
    dependents.push(edge.dependent.name);
    dependentMap.set(edge.prerequisiteId, dependents);
  }

  const gaps: KnowledgeGap[] = masteries
    .filter((mastery) => mastery.masteryScore < 70)
    .sort((a, b) => a.masteryScore - b.masteryScore)
    .slice(0, 10)
    .map((mastery) => {
      const prerequisite = edges.find((edge) => edge.dependentId === mastery.conceptId && (masteryByConcept.get(edge.prerequisiteId)?.masteryScore || 0) < mastery.masteryScore);
      const impact = (dependentMap.get(mastery.conceptId)?.length || 0) >= 3 ? 'HIGH' : (dependentMap.get(mastery.conceptId)?.length || 0) > 0 ? 'MEDIUM' : 'LOW';
      return {
        conceptId: mastery.conceptId,
        conceptName: mastery.concept.name,
        mastery: mastery.masteryScore,
        rootCause: prerequisite ? `${prerequisite.prerequisite.name} is also below target.` : 'Direct mastery deficit detected.',
        impact,
        downstreamConcepts: dependentMap.get(mastery.conceptId) || [],
      };
    });

  const overallGapScore = masteries.length ? Math.min(100, gaps.reduce((sum, gap) => sum + (100 - gap.mastery), 0) / masteries.length * 1.25) : 0;
  const confidence = masteries.length ? Math.min(1, 0.55 + Math.min(0.4, masteries.length / 25)) : 0.35;
  const prediction: KnowledgeGapPrediction = { criticalGaps: gaps, overallGapScore, confidence };
  const result: AgentResult = {
    agentType: 'KNOWLEDGE_GAP',
    studentId,
    prediction,
    reasoning: gaps.length ? `Graph traversal found ${gaps.length} concepts below the 70% mastery threshold and mapped their downstream dependencies.` : 'No concepts currently fall below the 70% mastery threshold.',
    recommendedAction: gaps.length ? `Prioritize ${gaps.slice(0, 2).map((gap) => gap.conceptName).join(' and ')} and review their prerequisites.` : 'Continue current practice and complete the next mastery check.',
    confidence,
    executedAt: new Date(),
  };
  await prisma.agentLog.create({
    data: {
      studentId,
      agentType: PrismaAgentType.CONCEPT_MASTERY,
      status: 'COMPLETED',
      input: { studentId, masteryCount: masteries.length, edgeCount: edges.length, triggeredBy },
      output: result as unknown as object,
      confidence,
      triggeredBy,
      executionTimeMs: Date.now() - startedAt,
    },
  });
  return result;
}
