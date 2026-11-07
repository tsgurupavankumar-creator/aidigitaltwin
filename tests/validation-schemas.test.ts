import test from 'node:test';
import assert from 'node:assert/strict';
import {
  InternalPersistencePayloadSchema,
  InternalServiceTokenHeaderSchema,
} from '../src/lib/validation/internal-persistence';
import {
  InternalServiceAuthError,
  InternalServiceConfigError,
  assertInternalServiceToken,
} from '../src/lib/validation/internal-service-token';
import {
  QuizGenerationOutputSchema,
  QuizGenerationRequestSchema,
} from '../src/lib/validation/quiz-generation';
import {
  StudyPlanOutputSchema,
  StudyPlanStepSchema,
} from '../src/lib/validation/study-plan';
import {
  SyllabusParseResultSchema,
  SyllabusTopicSelectionSchema,
  SyllabusUploadRequestSchema,
} from '../src/lib/validation/syllabus';

const ID = 'clh1234567890abcdefghijk';
const FAKE_TOKEN = 'fake-internal-service-token-for-tests-0001';
const OTHER_FAKE_TOKEN = 'other-internal-service-token-for-tests-01';

const validUpload = {
  originalFileName: 'syllabus.pdf',
  mimeType: 'application/pdf',
  fileSizeBytes: 1024,
};

const validSyllabus = {
  modules: [{
    name: 'Foundations',
    orderIndex: 0,
    topics: [{ name: 'Sets', orderIndex: 0 }],
  }],
};

const validSelection = {
  selectedTopicIds: [ID],
  courseId: ID,
  syllabusId: ID,
};

const validQuizRequest = {
  courseId: ID,
  syllabusId: ID,
  studentId: ID,
  selectedTopicIds: [ID],
};

const validStudyStep = {
  title: 'Review relational algebra',
  reason: 'It is a prerequisite for the selected SQL topic.',
  estimatedMinutes: 30,
  syllabusTopicId: ID,
  conceptId: null,
  orderIndex: 0,
};

const validStudyPlan = {
  steps: [
    validStudyStep,
    { ...validStudyStep, title: 'Practice examples', orderIndex: 1 },
    { ...validStudyStep, title: 'Check understanding', orderIndex: 2 },
  ],
};

const validQuizOutput = {
  questions: [
    {
      type: 'mcq',
      difficulty: 'easy',
      prompt: 'Which operation combines rows from two relations?',
      options: ['Join', 'Project'],
      correctAnswer: 'Join',
      syllabusTopicId: ID,
      conceptId: null,
    },
    {
      type: 'true_false',
      difficulty: 'medium',
      prompt: 'A relation is a set of tuples.',
      correctAnswer: 'true',
      syllabusTopicId: ID,
      conceptId: ID,
    },
    {
      type: 'short_answer',
      difficulty: 'hard',
      prompt: 'Name a property of a relation.',
      correctAnswer: 'No duplicate tuples',
      syllabusTopicId: ID,
      conceptId: null,
    },
  ],
};

const validPersistencePayload = {
  studentId: ID,
  runId: '4d3d4c30-a6ab-4e31-b0d3-cfe1041109a2',
  degraded: false,
  operations: [
    { type: 'twin_update', data: { academicHealth: 80 } },
    { type: 'risk_assessment', data: { riskLevel: 'LOW', probability: 0.1, rationale: 'No high-risk signals.' } },
    { type: 'agent_log', data: { agentName: 'learning', input: { count: 2 }, output: ['ok'], durationMs: 120 } },
    { type: 'study_plan', data: validStudyPlan },
    { type: 'snapshot', data: { capturedAt: '2026-11-03T10:00:00Z' } },
  ],
};

test('SyllabusUploadRequestSchema accepts bounded PDF metadata and rejects invalid or extra fields', () => {
  assert.equal(SyllabusUploadRequestSchema.safeParse(validUpload).success, true);
  assert.equal(SyllabusUploadRequestSchema.safeParse({ ...validUpload, fileSizeBytes: 10 * 1024 * 1024 + 1 }).success, false);
  assert.equal(SyllabusUploadRequestSchema.safeParse({ ...validUpload, mimeType: 'text/plain' }).success, false);
  assert.equal(SyllabusUploadRequestSchema.safeParse({ mimeType: 'application/pdf', fileSizeBytes: 10 }).success, false);
  assert.equal(SyllabusUploadRequestSchema.safeParse({ ...validUpload, unexpected: true }).success, false);
});

test('SyllabusParseResultSchema validates module/topic bounds, indices, and strict nested objects', () => {
  assert.equal(SyllabusParseResultSchema.safeParse(validSyllabus).success, true);
  assert.equal(SyllabusParseResultSchema.safeParse({ modules: [] }).success, false);
  assert.equal(SyllabusParseResultSchema.safeParse({ modules: [{ ...validSyllabus.modules[0], topics: [] }] }).success, false);
  assert.equal(SyllabusParseResultSchema.safeParse({ modules: [{ ...validSyllabus.modules[0], orderIndex: -1 }] }).success, false);
  assert.equal(SyllabusParseResultSchema.safeParse({ ...validSyllabus, extra: true }).success, false);
  assert.equal(SyllabusParseResultSchema.safeParse({ modules: [{ ...validSyllabus.modules[0], extra: true }] }).success, false);
  assert.equal(SyllabusParseResultSchema.safeParse({ modules: [{ ...validSyllabus.modules[0], topics: [{ name: 'Sets', orderIndex: 0, extra: true }] }] }).success, false);
});

test('SyllabusTopicSelectionSchema validates bounded IDs and rejects missing and unknown fields', () => {
  assert.equal(SyllabusTopicSelectionSchema.safeParse(validSelection).success, true);
  assert.equal(SyllabusTopicSelectionSchema.safeParse({ ...validSelection, selectedTopicIds: [] }).success, false);
  assert.equal(SyllabusTopicSelectionSchema.safeParse({ ...validSelection, courseId: 'bad id' }).success, false);
  assert.equal(SyllabusTopicSelectionSchema.safeParse({ selectedTopicIds: [ID], courseId: ID }).success, false);
  assert.equal(SyllabusTopicSelectionSchema.safeParse({ ...validSelection, extra: true }).success, false);
});

test('QuizGenerationRequestSchema applies defaults and rejects invalid bounds and unknown fields', () => {
  const parsed = QuizGenerationRequestSchema.parse(validQuizRequest);
  assert.equal(parsed.questionCount, 10);
  assert.deepEqual(parsed.questionTypes, ['mcq', 'true_false', 'short_answer']);
  assert.equal(parsed.difficulty, 'mixed');
  assert.equal(QuizGenerationRequestSchema.safeParse({ ...validQuizRequest, questionCount: 31 }).success, false);
  assert.equal(QuizGenerationRequestSchema.safeParse({ ...validQuizRequest, questionCount: '10' }).success, false);
  assert.equal(QuizGenerationRequestSchema.safeParse({ ...validQuizRequest, questionTypes: [] }).success, false);
  assert.equal(QuizGenerationRequestSchema.safeParse({ ...validQuizRequest, extra: true }).success, false);
});

test('QuizGenerationOutputSchema accepts all variants and rejects unknown top-level fields', () => {
  assert.equal(QuizGenerationOutputSchema.safeParse(validQuizOutput).success, true);
  assert.equal(QuizGenerationOutputSchema.safeParse({ ...validQuizOutput, extra: true }).success, false);
  assert.equal(QuizGenerationOutputSchema.safeParse({ questions: [] }).success, false);
  assert.equal(QuizGenerationOutputSchema.safeParse({ questions: Array.from({ length: 31 }, () => validQuizOutput.questions[1]) }).success, false);
});

test('MCQ output requires options and a correct answer from those options', () => {
  const mcq = validQuizOutput.questions[0];
  assert.equal(QuizGenerationOutputSchema.safeParse({ questions: [{ ...mcq, options: undefined }] }).success, false);
  assert.equal(QuizGenerationOutputSchema.safeParse({ questions: [{ ...mcq, options: ['Only one'] }] }).success, false);
  assert.equal(QuizGenerationOutputSchema.safeParse({ questions: [{ ...mcq, correctAnswer: 'Not listed' }] }).success, false);
  assert.equal(QuizGenerationOutputSchema.safeParse({ questions: [{ ...mcq, extra: true }] }).success, false);
});

test('true_false output is lowercase-only and does not accept options', () => {
  const truth = validQuizOutput.questions[1];
  assert.equal(QuizGenerationOutputSchema.safeParse({ questions: [{ ...truth, options: ['true', 'false'] }] }).success, false);
  assert.equal(QuizGenerationOutputSchema.safeParse({ questions: [{ ...truth, correctAnswer: 'True' }] }).success, false);
  assert.equal(QuizGenerationOutputSchema.safeParse({ questions: [{ ...truth, correctAnswer: 'FALSE' }] }).success, false);
});

test('StudyPlanStepSchema and StudyPlanOutputSchema enforce references, bounds, defaults, and strict objects', () => {
  assert.equal(StudyPlanStepSchema.safeParse(validStudyStep).success, true);
  assert.equal(StudyPlanStepSchema.safeParse({ ...validStudyStep, estimatedMinutes: 4 }).success, false);
  assert.equal(StudyPlanStepSchema.safeParse({ ...validStudyStep, syllabusTopicId: 'bad id' }).success, false);
  assert.equal(StudyPlanStepSchema.safeParse({ ...validStudyStep, extra: true }).success, false);

  const parsed = StudyPlanOutputSchema.parse(validStudyPlan);
  assert.equal(parsed.horizon, 'this_week');
  assert.equal(StudyPlanOutputSchema.safeParse({ steps: validStudyPlan.steps.slice(0, 2) }).success, false);
  assert.equal(StudyPlanOutputSchema.safeParse({ ...validStudyPlan, horizon: 'next_year' }).success, false);
  assert.equal(StudyPlanOutputSchema.safeParse({ ...validStudyPlan, extra: true }).success, false);
});

test('InternalPersistencePayloadSchema validates every operation and rejects extra fields', () => {
  assert.equal(InternalPersistencePayloadSchema.safeParse(validPersistencePayload).success, true);
  assert.equal(InternalPersistencePayloadSchema.safeParse({ ...validPersistencePayload, runId: 'not-a-uuid' }).success, false);
  assert.equal(InternalPersistencePayloadSchema.safeParse({ ...validPersistencePayload, extra: true }).success, false);
  assert.equal(InternalPersistencePayloadSchema.safeParse({ ...validPersistencePayload, operations: [] }).success, false);
  assert.equal(InternalPersistencePayloadSchema.safeParse({ ...validPersistencePayload, operations: Array.from({ length: 51 }, () => validPersistencePayload.operations[0]) }).success, false);
  assert.equal(InternalPersistencePayloadSchema.safeParse({ ...validPersistencePayload, operations: [{ ...validPersistencePayload.operations[0], extra: true }] }).success, false);
  assert.equal(InternalPersistencePayloadSchema.safeParse({
    ...validPersistencePayload,
    operations: [{ type: 'twin_update', data: { unknownDimension: 1 } }],
  }).success, false);
  assert.equal(InternalPersistencePayloadSchema.safeParse({
    ...validPersistencePayload,
    operations: [{ type: 'agent_log', data: { agentName: 'learning', input: 'x'.repeat(8001), output: null, durationMs: 1 } }],
  }).success, false);
  assert.equal(InternalPersistencePayloadSchema.safeParse({
    ...validPersistencePayload,
    operations: [{ type: 'snapshot', data: { capturedAt: 'yesterday', extra: true } }],
  }).success, false);
});

test('InternalServiceTokenHeaderSchema requires a 32-character token and rejects extra keys', () => {
  assert.equal(InternalServiceTokenHeaderSchema.safeParse({ 'x-internal-service-token': FAKE_TOKEN }).success, true);
  assert.equal(InternalServiceTokenHeaderSchema.safeParse({ 'x-internal-service-token': 'short' }).success, false);
  assert.equal(InternalServiceTokenHeaderSchema.safeParse({}).success, false);
  assert.equal(InternalServiceTokenHeaderSchema.safeParse({ 'x-internal-service-token': FAKE_TOKEN, extra: true }).success, false);
});

test('assertInternalServiceToken accepts a matching token and rejects missing or mismatched tokens without disclosure', () => {
  const previous = process.env.INTERNAL_SERVICE_SECRET;
  process.env.INTERNAL_SERVICE_SECRET = FAKE_TOKEN;
  try {
    assert.doesNotThrow(() => assertInternalServiceToken(new Headers({ 'x-internal-service-token': FAKE_TOKEN })));
    assert.throws(
      () => assertInternalServiceToken(new Headers()),
      (error: unknown) => error instanceof InternalServiceAuthError && !error.message.includes(FAKE_TOKEN),
    );
    assert.throws(
      () => assertInternalServiceToken(new Headers({ 'x-internal-service-token': OTHER_FAKE_TOKEN })),
      (error: unknown) => error instanceof InternalServiceAuthError
        && !error.message.includes(FAKE_TOKEN)
        && !error.message.includes(OTHER_FAKE_TOKEN),
    );
  } finally {
    if (previous === undefined) delete process.env.INTERNAL_SERVICE_SECRET;
    else process.env.INTERNAL_SERVICE_SECRET = previous;
  }
});

test('assertInternalServiceToken reports configuration errors only after a header is present', () => {
  const previous = process.env.INTERNAL_SERVICE_SECRET;
  delete process.env.INTERNAL_SERVICE_SECRET;
  try {
    assert.throws(
      () => assertInternalServiceToken(new Headers()),
      (error: unknown) => error instanceof InternalServiceAuthError,
    );
    assert.throws(
      () => assertInternalServiceToken(new Headers({ 'x-internal-service-token': FAKE_TOKEN })),
      (error: unknown) => error instanceof InternalServiceConfigError && !error.message.includes(FAKE_TOKEN),
    );
    process.env.INTERNAL_SERVICE_SECRET = 'too-short';
    assert.throws(
      () => assertInternalServiceToken(new Headers({ 'x-internal-service-token': FAKE_TOKEN })),
      (error: unknown) => error instanceof InternalServiceConfigError,
    );
  } finally {
    if (previous === undefined) delete process.env.INTERNAL_SERVICE_SECRET;
    else process.env.INTERNAL_SERVICE_SECRET = previous;
  }
});

test('assertInternalServiceToken safely rejects unequal token lengths and compares equal-length values', () => {
  const previous = process.env.INTERNAL_SERVICE_SECRET;
  process.env.INTERNAL_SERVICE_SECRET = FAKE_TOKEN;
  try {
    assert.throws(
      () => assertInternalServiceToken(new Headers({ 'x-internal-service-token': `${FAKE_TOKEN}x` })),
      (error: unknown) => error instanceof InternalServiceAuthError && !error.message.includes(FAKE_TOKEN),
    );
    assert.throws(
      () => assertInternalServiceToken(new Headers({ 'x-internal-service-token': OTHER_FAKE_TOKEN })),
      InternalServiceAuthError,
    );
  } finally {
    if (previous === undefined) delete process.env.INTERNAL_SERVICE_SECRET;
    else process.env.INTERNAL_SERVICE_SECRET = previous;
  }
});
