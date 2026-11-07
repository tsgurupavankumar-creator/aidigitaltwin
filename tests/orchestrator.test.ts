/**
 * Control-flow tests for orchestrate(). The database and the three agents are
 * stubbed by pre-populating Node's module cache BEFORE the orchestrator is
 * loaded, so no database, ML service, or network is involved.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { AgentResult, LLMActionPlan, OrchestrationResult } from '../src/lib/agents/types';
import type { LLMPlanResult } from '../src/lib/agents/llm-learning-plan';

type Created = Array<{ data: Record<string, unknown> }>;

const lookups: string[] = [];
const scoredWork = { count: 1 };

const state = {
  marker: null as { output: unknown } | null,
  learning: 'ok' as 'ok' | 'throw',
  attendance: 'ok' as 'ok' | 'throw',
  knowledge: 'ok' as 'ok' | 'throw',
  attendanceAtRisk: false,
  attendanceConfidence: 0.8,
  gapScore: 20,
  llm: 'disabled' as 'disabled' | 'throw' | 'success',
  calls: { learning: 0, attendance: 0, knowledge: 0 },
  riskAssessments: [] as Created,
  alerts: [] as Created,
  recommendations: [] as Created,
  studyPlans: [] as Created,
  interventions: [] as Created,
  agentLogs: [] as Created,
  snapshots: [] as Array<Record<string, unknown>>,
  twinUpdates: [] as Created,
};

function reset() {
  Object.assign(state, {
    marker: null, learning: 'ok', attendance: 'ok', knowledge: 'ok', attendanceAtRisk: false,
    attendanceConfidence: 0.8, gapScore: 20, llm: 'disabled',
    calls: { learning: 0, attendance: 0, knowledge: 0 },
    riskAssessments: [], alerts: [], recommendations: [], studyPlans: [], interventions: [], agentLogs: [], twinUpdates: [], snapshots: [],
  });
}

const fakePrisma = {
  $transaction: async (callback: (tx: any) => Promise<unknown>) => {
    const before = {
      riskAssessments: [...state.riskAssessments],
      alerts: [...state.alerts],
      recommendations: [...state.recommendations],
      studyPlans: [...state.studyPlans],
      interventions: [...state.interventions],
      agentLogs: [...state.agentLogs],
      snapshots: [...state.snapshots],
      twinUpdates: [...state.twinUpdates],
    };
    try {
      return await callback(fakePrisma);
    } catch (error) {
      Object.assign(state, before);
      throw error;
    }
  },
  quizAttempt: { count: async () => scoredWork.count },
  submission: { count: async () => 0 },
  twinSnapshot: { create: async (args: { data: Record<string, unknown> }) => { state.snapshots.push(args.data); return args.data; } },
  agentLog: {
    findFirst: async (args: { where: { triggeredBy: string } }) => { lookups.push(args.where.triggeredBy); return state.marker; },
    create: async (args: { data: Record<string, unknown> }) => { state.agentLogs.push(args); return args; },
  },
  digitalTwin: {
    findUnique: async () => ({ attendanceScore: 90, knowledgeScore: 60, performanceScore: 70 }),
    update: async (args: { data: Record<string, unknown> }) => { state.twinUpdates.push(args); return args; },
  },
  student: { findUnique: async () => ({ department: 'CSE' }) },
  enrollment: { findMany: async () => [] },
  alert: { create: async (args: { data: Record<string, unknown> }) => { state.alerts.push(args); return args; } },
  recommendation: { create: async (args: { data: Record<string, unknown> }) => { state.recommendations.push(args); return args; } },
  studyPlan: { create: async (args: { data: Record<string, unknown> }) => { state.studyPlans.push(args); return { id: 'study-plan-1' }; } },
  faculty: { findFirst: async () => ({ id: 'fac-1' }) },
  intervention: { create: async (args: { data: Record<string, unknown> }) => { state.interventions.push(args); return { id: 'int-1' }; } },
  riskAssessment: { create: async (args: { data: Record<string, unknown> }) => { state.riskAssessments.push(args); return args; } },
};

const base = { studentId: 's1', recommendedAction: 'do it', executedAt: new Date() };

function stubModule(path: string, exports: object) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports, children: [], paths: [], path: '' } as unknown as NodeJS.Module;
}

stubModule('../src/lib/prisma', { prisma: fakePrisma });
stubModule('../src/lib/twin/dimension-inputs', {
  loadDimensionInputs: async () => ({
    attendance: ['PRESENT', 'PRESENT', 'ABSENT', 'PRESENT'], pastDueAssignments: 4, handedInPastDue: 3, handedIn: 3, handedInLate: 1,
    quizzesAvailable: 5, quizzesAttempted: 4, mastery: [{ masteryScore: 80, previousScore: 70, assessmentCount: 2 }, { masteryScore: 50, previousScore: 60, assessmentCount: 2 }],
  }),
});
stubModule('../src/lib/agents/learning-analysis', {
  runLearningAnalysis: async (): Promise<AgentResult> => {
    state.calls.learning += 1;
    if (state.learning === 'throw') throw new Error('ML service returned a fallback prediction');
    return { ...base, agentType: 'LEARNING_ANALYSIS', reasoning: 'learn', confidence: 0.6,
      prediction: { nextExamScore: 70, modelUsed: 'trained', trend: 'STABLE', confidence: 0.6, topWeakConcepts: [], topStrongConcepts: [] } };
  },
});
stubModule('../src/lib/agents/attendance-risk', {
  runAttendanceRisk: async (): Promise<AgentResult> => {
    state.calls.attendance += 1;
    if (state.attendance === 'throw') throw new Error('ML service unreachable');
    return { ...base, agentType: 'ATTENDANCE_RISK', reasoning: 'att', confidence: state.attendanceConfidence,
      prediction: { modelUsed: 'trained', atRisk: state.attendanceAtRisk, riskScore: state.attendanceAtRisk ? 0.8 : 0.1,
        currentAttendance: 85, projectedAttendance: 84, daysUntilCritical: 30, confidence: state.attendanceConfidence } };
  },
});
stubModule('../src/lib/agents/knowledge-gap', {
  runKnowledgeGap: async (): Promise<AgentResult> => {
    state.calls.knowledge += 1;
    if (state.knowledge === 'throw') throw new Error('graph query failed');
    return { ...base, agentType: 'KNOWLEDGE_GAP', reasoning: 'gap', confidence: 0.7,
      prediction: { criticalGaps: [], overallGapScore: state.gapScore, confidence: 0.7 } };
  },
});
stubModule('../src/lib/agents/llm-learning-plan', {
  proposeLearningPlan: async (): Promise<LLMPlanResult | null> => {
    if (state.llm === 'throw') throw new Error('The operation timed out');
    if (state.llm === 'disabled') {
      if (process.env.LLM_ENABLED === 'true' && !process.env.OPENAI_API_KEY) throw new Error('missing_api_key');
      return null;
    }
    const plan: LLMActionPlan = {
      actionType: 'PRACTICE',
      facultyAction: 'NONE',
      facultyNote: '',
      tasks: [{
        conceptAlias: 'C1',
        title: 'Practice the weak concept',
        reason: 'Mastery is below target.',
        priority: 'HIGH',
        estimatedMins: 25,
      }],
    };
    return {
      plan: {
        ...plan,
        tasks: plan.tasks.map((task) => ({ ...task, conceptId: 'concept-1' })),
      },
      audit: { model: 'test-model', promptVersion: 'academic-plan-v2', outcome: 'validated', itemCount: 1 },
    };
  },
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { orchestrate } = require('../src/lib/agents/orchestrator') as {
  orchestrate: (studentId: string, event: string, options?: { sourceKey?: string }) => Promise<OrchestrationResult>;
};

const markers = () => state.agentLogs.filter((c) => String(c.data.triggeredBy).startsWith('orchestrate:'));

test('happy path: persists once, records real values only, writes the idempotency marker', async () => {
  reset();
  const res = await orchestrate('s1', 'weekly_review');
  assert.equal(res.degraded, undefined);
  assert.equal(res.agentErrors, undefined);
  assert.equal(state.riskAssessments.length, 1);
  const ra = state.riskAssessments[0].data;
  assert.equal(ra.confidenceScore, 0.7);                       // mean(0.6, 0.8, 0.7)
  assert.equal(ra.predictedGPA, 7);                            // 10-point: the real 70% prediction / 10, not a default
  const factors = ra.factors as Record<string, unknown> & { signalSources: Record<string, string> };
  assert.deepEqual(factors.signalSources, { attendance: 'agent', knowledge: 'agent', learning: 'agent' });
  assert.equal(state.twinUpdates.length, 1);
  assert.equal(markers().length, 1);
});

test('valid LLM plan creates AI study tasks and task-based recommendations transactionally', async () => {
  reset();
  state.llm = 'success';
  const result = await orchestrate('s1', 'weekly_review');

  assert.equal(result.llm?.used, true);
  assert.equal(state.studyPlans.length, 1);
  const plan = state.studyPlans[0].data;
  assert.match(String(plan.title), /^AI Tutor Plan:/);
  const tasks = (plan.tasks as { create: Array<Record<string, unknown>> }).create;
  assert.deepEqual(tasks, [{ conceptId: 'concept-1', priority: 'HIGH', estimatedMins: 25 }]);
  assert.equal(state.recommendations.length, 1);
  assert.equal(state.recommendations[0].data.title, 'Practice the weak concept');
  assert.equal(state.recommendations[0].data.reason, 'Mastery is below target.');
  assert.equal(state.recommendations[0].data.actionType, 'PRACTICE');
  assert.equal(state.riskAssessments[0].data.riskLevel, 'LOW');
});

test('LLM timeout falls back to rule-based recommendations and logs degraded status without crashing', async () => {
  reset();
  state.llm = 'throw';
  const result = await orchestrate('s1', 'weekly_review');

  assert.equal(result.degraded, undefined);
  assert.equal(result.llm?.used, false);
  assert.equal(result.llm?.degraded, true);
  assert.equal(state.studyPlans.length, 0);
  assert.equal(state.recommendations.length, 1);
  assert.equal(state.recommendations[0].data.title, 'Continue the current learning routine and complete the next scheduled assessment.');
  assert.equal(state.riskAssessments.length, 1);
  const failure = state.agentLogs.find((entry) => entry.data.status === 'FAILED');
  assert.equal((failure?.data.output as { degraded: boolean }).degraded, true);
  assert.equal((failure?.data.output as { fallback: string }).fallback, 'rule_based');
});

test('DEGRADED: an agent failure is reported and NOTHING is persisted (no risk row, alerts, recs, marker)', async () => {
  reset();
  state.learning = 'throw';
  state.attendanceAtRisk = true;       // would normally raise an alert; must not be persisted in a degraded run
  const res = await orchestrate('s1', 'weekly_review');
  assert.equal(res.degraded, true);
  assert.deepEqual(res.agentErrors, [{ agent: 'learning', message: 'ML service returned a fallback prediction' }]);
  assert.equal(res.results.length, 2);                         // the two agents that did succeed
  assert.equal(res.intervention.shouldEscalateToFaculty, false);
  assert.equal(state.riskAssessments.length, 0);
  assert.equal(state.alerts.length, 0);
  assert.equal(state.recommendations.length, 0);
  assert.equal(state.interventions.length, 0);
  assert.equal(state.twinUpdates.length, 0);
  assert.equal(markers().length, 0);
});

test('a degraded run is NOT cached: a retry re-runs and then completes normally', async () => {
  reset();
  state.learning = 'throw';
  const first = await orchestrate('s1', 'weekly_review');
  assert.equal(first.degraded, true);
  state.learning = 'ok';                                       // ML service recovers
  const second = await orchestrate('s1', 'weekly_review');
  assert.equal(second.degraded, undefined);
  assert.equal(state.calls.learning, 2);                       // it really re-ran
  assert.equal(state.riskAssessments.length, 1);
  assert.equal(markers().length, 1);
});

test('all agents failing: reported honestly, empty results, no "continue your routine" message', async () => {
  reset();
  state.learning = state.attendance = state.knowledge = 'throw';
  const res = await orchestrate('s1', 'weekly_review');
  assert.equal(res.degraded, true);
  assert.equal(res.results.length, 0);
  assert.equal(res.agentErrors?.length, 3);
  assert.match(res.intervention.recommendedActions[0], /did not complete/);
  assert.equal(state.riskAssessments.length, 0);
});

test('replay: a completed marker for this hour short-circuits and is flagged, agents do not run', async () => {
  reset();
  const prior: OrchestrationResult = {
    results: [], executedAt: new Date(),
    intervention: { flags: [], severity: 'LOW', studentId: 's1', recommendedActions: ['x'], shouldEscalateToFaculty: false, triggeredAt: new Date() },
  };
  state.marker = { output: prior };
  const res = await orchestrate('s1', 'weekly_review');
  assert.equal(res.replayed, true);
  assert.deepEqual(state.calls, { learning: 0, attendance: 0, knowledge: 0 });
  assert.equal(state.agentLogs.length, 0);
  assert.equal(state.riskAssessments.length, 0);
});

test('attendance_marked runs only the attendance agent: no learning input means null GPA, not 3.65', async () => {
  reset();
  const res = await orchestrate('s1', 'attendance_marked');
  assert.equal(res.degraded, undefined);
  assert.deepEqual(state.calls, { learning: 0, attendance: 1, knowledge: 0 });
  const ra = state.riskAssessments[0].data;
  assert.equal(ra.predictedGPA, null);
  assert.equal(ra.confidenceScore, 0.8);                       // only the attendance agent's real confidence
  const factors = ra.factors as { learningRisk: unknown; knowledgeGapScore: unknown; predictedExamScore: unknown };
  assert.equal(factors.learningRisk, null);
  assert.equal(factors.knowledgeGapScore, null);               // was invented as 35
  assert.equal(factors.predictedExamScore, null);              // was invented as 75
});

test('recommendation confidence is the real maximum, with no 0.7 floor', async () => {
  reset();
  state.attendanceAtRisk = true;
  state.attendanceConfidence = 0.4;                            // lower than every other agent's 0.6 / 0.7
  state.gapScore = 20;
  await orchestrate('s1', 'attendance_marked');                // only attendance runs, confidence 0.4
  assert.ok(state.recommendations.length >= 1);
  assert.ok(state.recommendations.every((r) => r.data.confidence === 0.4));
});

test('two independent flags escalate to faculty and persist an intervention', async () => {
  reset();
  state.attendanceAtRisk = true;
  state.gapScore = 80;                                         // > 60 → KNOWLEDGE flag; with ATTENDANCE → HIGH
  const res = await orchestrate('s1', 'weekly_review');
  assert.equal(res.intervention.severity, 'HIGH');
  assert.equal(res.persistedInterventionId, 'int-1');
  assert.equal(state.interventions.length, 1);
});

test('data-triggered runs are keyed on the change, not the hour (two lectures in one hour both run)', async () => {
  reset(); lookups.length = 0;
  await orchestrate('s1', 'attendance_marked', { sourceKey: 'attendance:a1:2026-10-17T10:00:00.000Z' });
  await orchestrate('s1', 'attendance_marked', { sourceKey: 'attendance:a2:2026-10-17T10:05:00.000Z' });
  assert.deepEqual(lookups, [
    'orchestrate:s1:attendance_marked:src:attendance:a1:2026-10-17T10:00:00.000Z',
    'orchestrate:s1:attendance_marked:src:attendance:a2:2026-10-17T10:05:00.000Z',
  ]);
  assert.equal(state.calls.attendance, 2);
  assert.deepEqual(markers().map((m) => m.data.triggeredBy), lookups);
});

test('without a source key the hourly guard is unchanged', async () => {
  reset(); lookups.length = 0;
  await orchestrate('s1', 'weekly_review');
  assert.match(lookups[0], /^orchestrate:s1:weekly_review:\d{4}-\d{2}-\d{2}T\d{2}$/);
});

test('a student with no scored work skips the learning model; the other agents still update the twin', async () => {
  reset(); scoredWork.count = 0;
  const out = await orchestrate('s1', 'weekly_review');
  scoredWork.count = 1;
  assert.equal(state.calls.learning, 0, 'learning model must not be fed zeros');
  assert.ok(state.calls.attendance >= 1 && state.calls.knowledge >= 1);
  assert.ok(!out.degraded, 'skipping is not a failure');
  assert.ok(markers().length === 1, 'run completes and is recorded');
});

test('LLM switched on but unavailable: the run is still saved, `degraded` stays unset, the fallback is reported in `llm`', async () => {
  reset();
  const prev = { e: process.env.LLM_ENABLED, k: process.env.OPENAI_API_KEY };
  process.env.LLM_ENABLED = 'true';
  delete process.env.OPENAI_API_KEY;
  try {
    const res = await orchestrate('s1', 'weekly_review');
    assert.equal(res.degraded, undefined, 'degraded means "nothing saved"; this run was saved');
    assert.equal(res.agentErrors, undefined);
    assert.equal(res.llm?.degraded, true);
    assert.equal(state.riskAssessments.length, 1, 'risk assessment saved with rule-based recommendations');
    assert.equal(markers().length, 1, 'completed run recorded');
  } finally {
    if (prev.e === undefined) delete process.env.LLM_ENABLED; else process.env.LLM_ENABLED = prev.e;
    if (prev.k !== undefined) process.env.OPENAI_API_KEY = prev.k;
  }
});

test('LLM step fails (e.g. a fake or expired API key): no crash, review saved, rule-based fallback logged with degraded: true', async () => {
  reset();
  state.llm = 'throw';
  const res = await orchestrate('s1', 'weekly_review');
  assert.equal(res.degraded, undefined, 'the review itself is not degraded: it was saved');
  assert.equal(res.llm?.degraded, true);
  assert.equal(state.riskAssessments.length, 1, 'risk assessment saved');
  assert.ok(state.recommendations.length >= 1, 'rule-based recommendations saved');
  const log = state.agentLogs.find((c) => (c.data.output as { fallback?: string } | undefined)?.fallback === 'rule_based');
  assert.ok(log, 'a fallback agent log was written');
  assert.equal((log!.data.output as { degraded: boolean }).degraded, true);
  assert.equal(log!.data.status, 'FAILED');
});

test('twin history: a completed run writes all 8 dimensions to the twin and one matching snapshot', async () => {
  reset();
  await orchestrate('s1', 'weekly_review');
  assert.equal(state.snapshots.length, 1);
  const snap = state.snapshots[0];
  for (const k of ['academicHealth', 'performanceScore', 'attendanceScore', 'knowledgeScore', 'engagementScore', 'behaviorScore', 'skillsScore', 'learningVelocity']) {
    assert.equal(typeof snap[k], 'number', k);
  }
  // From the stubbed records: attendance 3/4, hand-in 3/4, quizzes 4/5 -> 0.4*.75+0.4*.75+0.2*.8 = 0.76
  assert.equal(snap.engagementScore, 76);
  assert.equal(snap.behaviorScore, 70.8);        // late 1/3, missed 1/4 -> 100 x (1 - 0.5 x 1/3 - 0.5 x 1/4)
  assert.equal(snap.skillsScore, 50);            // 80 >= 70, 50 < 70
  assert.equal(snap.learningVelocity, 0.5);      // +10 and -10
  assert.equal(snap.event, 'weekly_review');
  assert.ok(snap.riskLevel);
});

test('twin history: a degraded run (nothing saved) writes no snapshot', async () => {
  reset();
  state.attendance = 'throw';
  await orchestrate('s1', 'weekly_review');
  assert.equal(state.snapshots.length, 0);
});

test('twin snapshot failure rolls back the completed run', async () => {
  reset();
  const original = fakePrisma.twinSnapshot.create;
  fakePrisma.twinSnapshot.create = async () => { throw new Error('snapshot insert failed'); };
  try {
    await assert.rejects(orchestrate('s1', 'weekly_review'), /snapshot insert failed/);
    assert.equal(state.snapshots.length, 0);
    assert.equal(state.riskAssessments.length, 0);
    assert.equal(state.twinUpdates.length, 0);
    assert.equal(markers().length, 0);
  } finally {
    fakePrisma.twinSnapshot.create = original;
  }
});

test('rule-based recommendations name the weak concept and say why; attendance advice carries the agent reasoning', async () => {
  const { ruleRecommendations } = await import('../src/lib/agents/orchestrator');
  const results = [
    { agentType: 'KNOWLEDGE_GAP', confidence: 0.7, reasoning: '', prediction: { overallGapScore: 70, confidence: 0.7, criticalGaps: [
      { conceptId: 'k2', conceptName: 'SQL Joins', mastery: 42, rootCause: 'Keys', impact: 'HIGH', downstreamConcepts: ['Views'] },
      { conceptId: 'k3', conceptName: 'Indexing', mastery: 61, rootCause: 'Indexing', impact: 'LOW', downstreamConcepts: [] },
    ] } },
    { agentType: 'ATTENDANCE_RISK', confidence: 0.8, reasoning: 'Attendance is 62%, below the 75% requirement.', prediction: {} },
  ] as never;
  const recs = ruleRecommendations({ flags: ['ATTENDANCE', 'KNOWLEDGE'], severity: 'HIGH', recommendedActions: [] } as never, results);
  assert.equal(recs[0].conceptId, 'k2', 'weakest concept first');
  assert.match(recs[0].reason, /42%.*Keys.*Views/);
  assert.equal(recs[1].conceptId, 'k3');
  assert.ok(!/may start in/.test(recs[1].reason), 'no root-cause sentence when the concept is its own root');
  const att = recs.find((r) => r.title.startsWith('Attend'))!;
  assert.equal(att.reason, 'Attendance is 62%, below the 75% requirement.');
  assert.equal(att.conceptId, null);
});
