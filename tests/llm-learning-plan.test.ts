import test from 'node:test';
import assert from 'node:assert/strict';
import { ZodError } from 'zod';
import { proposeLearningPlan } from '../src/lib/agents/llm-learning-plan';
import type { AgentResult, KnowledgeGapPrediction } from '../src/lib/agents/types';

const gap: KnowledgeGapPrediction = {
  criticalGaps: [{ conceptId: 'concept-secret-id', conceptName: 'Named Concept', mastery: 42, rootCause: 'Low mastery', impact: 'HIGH', downstreamConcepts: [] }],
  overallGapScore: 58,
  confidence: 0.8,
};
const results: AgentResult[] = [{
  agentType: 'KNOWLEDGE_GAP',
  studentId: 'student-private-id',
  prediction: gap,
  reasoning: 'Weak concept found',
  recommendedAction: 'Practice',
  confidence: 0.8,
  executedAt: new Date(),
}];

const oldEnv = {
  enabled: process.env.LLM_ENABLED,
  key: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL,
};
const oldFetch = global.fetch;
function restore() {
  if (oldEnv.enabled === undefined) delete process.env.LLM_ENABLED; else process.env.LLM_ENABLED = oldEnv.enabled;
  if (oldEnv.key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldEnv.key;
  if (oldEnv.model === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = oldEnv.model;
  global.fetch = oldFetch;
}

function validPlan() {
  return {
    actionType: 'PRACTICE',
    facultyAction: 'NONE',
    facultyNote: '',
    tasks: [{
      conceptAlias: 'C1',
      title: 'Practice foundational examples',
      reason: 'Mastery is below target.',
      priority: 'HIGH',
      estimatedMins: 25,
    }],
  };
}

function configureLLM() {
  process.env.LLM_ENABLED = 'true';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_MODEL = 'gpt-4o-mini';
}

test('LLM stage stays disabled by default and makes no network call', async () => {
  delete process.env.LLM_ENABLED;
  global.fetch = (async () => { throw new Error('should not fetch'); }) as typeof fetch;
  try {
    const result = await proposeLearningPlan({ knowledge: gap, riskLevel: 'MEDIUM' });
    assert.equal(result, null);
  } finally {
    restore();
  }
});

test('valid strict JSON is parsed and aliases resolve only to private local concept IDs', async () => {
  configureLLM();
  let requestBody = '';
  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBody = String(init?.body || '');
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(validPlan()) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  try {
    const result = await proposeLearningPlan({
      learning: {
        nextExamScore: 66,
        confidence: 0.7,
        modelUsed: 'trained',
        trend: 'DOWN',
        topWeakConcepts: [],
        topStrongConcepts: [],
      },
      attendance: {
        modelUsed: 'trained',
        atRisk: true,
        riskScore: 0.72,
        currentAttendance: 70,
        projectedAttendance: 65,
        daysUntilCritical: 10,
        confidence: 0.8,
      },
      knowledge: gap,
      riskLevel: 'HIGH',
    });

    const request = JSON.parse(requestBody) as { messages: Array<{ content: string }> };
    const evidence = JSON.parse(request.messages[1].content) as { computed_risk_level: string };
    assert.ok(result);
    assert.equal(result.plan.tasks.length, 1);
    assert.equal(result.plan.tasks[0].conceptId, 'concept-secret-id');
    assert.equal(result.plan.tasks[0].estimatedMins, 25);
    assert.equal(result.plan.tasks[0].priority, 'HIGH');
    assert.equal(requestBody.includes('student-private-id'), false);
    assert.equal(requestBody.includes('concept-secret-id'), false);
    assert.equal(requestBody.includes('Named Concept'), false);
    assert.equal(evidence.computed_risk_level, 'HIGH');
    assert.equal(JSON.parse(requestBody).response_format.type, 'json_schema');
    assert.match(request.messages[0].content, /You are an AI Academic Tutor/);
  } finally {
    restore();
  }
});

test('hallucinated concept aliases and invalid enums reject the whole plan', async (t) => {
  configureLLM();
  try {
    await t.test('unknown concept alias', async () => {
      global.fetch = (async () => new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          ...validPlan(),
          tasks: [{ ...validPlan().tasks[0], conceptAlias: 'C99' }],
        }) } }],
      }), { status: 200 })) as typeof fetch;

      await assert.rejects(
        proposeLearningPlan({ knowledge: gap, riskLevel: 'LOW' }),
        /unknown_concept_alias:C99/
      );
    });

    await t.test('invalid action enum', async () => {
      global.fetch = (async () => new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ ...validPlan(), actionType: 'DELETE' }) } }],
      }), { status: 200 })) as typeof fetch;

      await assert.rejects(
        proposeLearningPlan({ knowledge: gap, riskLevel: 'LOW' }),
        (error: unknown) => error instanceof ZodError
      );
    });
  } finally {
    restore();
  }
});

test('provider timeout is propagated for orchestrator rule-based fallback', async () => {
  configureLLM();
  global.fetch = (async () => {
    throw new DOMException('The operation timed out', 'TimeoutError');
  }) as typeof fetch;
  try {
    await assert.rejects(
      proposeLearningPlan({ knowledge: gap, riskLevel: 'HIGH' }),
      /timed out/
    );
  } finally {
    restore();
  }
});
