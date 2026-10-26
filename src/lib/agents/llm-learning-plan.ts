import type { LLMActionPlan, LLMFacultyAction, LLMStudyTask } from './types';
import { llmActionPlanSchema } from './types';
import type { AttendancePrediction, KnowledgeGapPrediction, LearningPrediction } from './types';

const PROMPT_VERSION = 'academic-plan-v2';
const SYSTEM_PROMPT = "You are an AI Academic Tutor. You will receive a JSON payload containing a student's ML predictions (learning and attendance) and their weak concepts. Your job is to output a strict JSON action plan. Do not recalculate risk. Do not invent concept IDs. Only use concepts from the provided 'weak_concepts' array. Generate 1-3 concrete study tasks with realistic estimated minutes and priority. Return ONLY valid JSON matching the provided schema.";

export interface LLMPlanInput {
  learning?: LearningPrediction;
  attendance?: AttendancePrediction;
  knowledge?: KnowledgeGapPrediction;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface PersistableLLMPlan {
  actionType: LLMActionPlan['actionType'];
  facultyAction: LLMFacultyAction;
  facultyNote: string;
  tasks: Array<LLMStudyTask & { conceptId: string }>;
}

export interface LLMPlanResult {
  plan: PersistableLLMPlan;
  audit: { model: string; promptVersion: string; outcome: string; itemCount: number };
}

const openAIResponseSchema = {
  name: 'academic_action_plan',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      actionType: { type: 'string', enum: ['STUDY', 'REVIEW', 'PRACTICE', 'TUTORING'] },
      facultyAction: { type: 'string', enum: ['NONE', 'TUTORING', 'COUNSELING', 'QUIZ', 'MEETING'] },
      facultyNote: { type: 'string' },
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            conceptAlias: { type: 'string' },
            title: { type: 'string' },
            reason: { type: 'string' },
            priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
            estimatedMins: { type: 'integer' },
          },
          required: ['conceptAlias', 'title', 'reason', 'priority', 'estimatedMins'],
        },
      },
    },
    required: ['actionType', 'facultyAction', 'facultyNote', 'tasks'],
  },
} as const;

/**
 * Returns a validated, privacy-minimized plan. Provider and schema failures are
 * intentionally thrown so the orchestrator can record degradation and use its
 * deterministic recommendation fallback.
 */
export async function proposeLearningPlan(input: LLMPlanInput): Promise<LLMPlanResult | null> {
  if (process.env.LLM_ENABLED !== 'true') return null;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('missing_api_key');

  const gaps = (input.knowledge?.criticalGaps || []).slice(0, 10);
  if (!gaps.length) return null;

  const aliases = gaps.map((gap, index) => ({
    conceptAlias: `C${index + 1}`,
    conceptId: gap.conceptId,
    mastery: Math.max(0, Math.min(100, Number(gap.mastery))),
    impact: gap.impact,
  }));

  const evidence = {
    learning: input.learning
      ? {
          score: input.learning.nextExamScore,
          confidence: input.learning.confidence,
        }
      : null,
    attendance: input.attendance
      ? {
          risk: input.attendance.riskScore,
          atRisk: input.attendance.atRisk,
          confidence: input.attendance.confidence,
        }
      : null,
    overall_knowledge_gap_score: input.knowledge?.overallGapScore ?? null,
    weak_concepts: aliases.map(({ conceptAlias, mastery, impact }) => ({
      conceptAlias,
      mastery,
      impact,
    })),
    computed_risk_level: input.riskLevel,
  };

  const timeoutMs = Math.max(1000, Math.min(15000, Number(process.env.LLM_TIMEOUT_MS) || 8000));
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: Math.max(200, Math.min(1600, Number(process.env.LLM_MAX_OUTPUT_TOKENS) || 1200)),
      response_format: { type: 'json_schema', json_schema: openAIResponseSchema },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify({ promptVersion: PROMPT_VERSION, ...evidence }) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`provider_http_${response.status}`);

  const payload: unknown = await response.json();
  const choice = (payload as {
    choices?: Array<{ message?: { content?: string | null; refusal?: string } }>;
  }).choices?.[0]?.message;
  if (!choice?.content || choice.refusal) {
    throw new Error(choice?.refusal ? 'provider_refusal' : 'empty_response');
  }

  const parsed: unknown = JSON.parse(choice.content);
  const actionPlan = llmActionPlanSchema.parse(parsed);
  const aliasToId = new Map(aliases.map((item) => [item.conceptAlias, item.conceptId]));
  const tasks = actionPlan.tasks.map((task) => {
    const conceptId = aliasToId.get(task.conceptAlias);
    if (!conceptId) throw new Error(`unknown_concept_alias:${task.conceptAlias}`);
    return { ...task, conceptId };
  });

  return {
    plan: {
      actionType: actionPlan.actionType,
      facultyAction: actionPlan.facultyAction,
      facultyNote: actionPlan.facultyNote,
      tasks,
    },
    audit: {
      model,
      promptVersion: PROMPT_VERSION,
      outcome: 'validated',
      itemCount: tasks.length,
    },
  };
}
