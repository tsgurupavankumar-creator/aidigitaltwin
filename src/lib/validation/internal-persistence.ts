import { z } from 'zod';
import { StudyPlanOutputSchema } from './study-plan';

const idString = z.string().min(10, 'Invalid ID').max(64, 'Invalid ID').regex(/^[a-z0-9-]+$/i, 'Invalid ID');

const boundedJson = z.unknown().refine((value) => {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === 'string' && serialized.length <= 8000;
  } catch {
    return false;
  }
}, 'Log payload exceeds 8KB serialized');

const twinDimensionsSchema = z.object({
  academicHealth: z.number().finite().optional(),
  performanceScore: z.number().finite().optional(),
  attendanceScore: z.number().finite().optional(),
  knowledgeScore: z.number().finite().optional(),
  engagementScore: z.number().finite().optional(),
  behaviorScore: z.number().finite().optional(),
  skillsScore: z.number().finite().optional(),
  learningVelocity: z.number().finite().optional(),
}).strict().refine(
  (dimensions) => Object.values(dimensions).some((value) => value !== undefined),
  { message: 'At least one twin dimension is required' },
);

const riskAssessmentSchema = z.object({
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  probability: z.number().finite().min(0).max(1),
  rationale: z.string().trim().min(1, 'Rationale is required').max(2000, 'Rationale must be 2,000 characters or fewer'),
}).strict();

const agentLogSchema = z.object({
  agentName: z.string().trim().min(1, 'Agent name is required').max(100, 'Agent name must be 100 characters or fewer'),
  input: boundedJson,
  output: boundedJson,
  durationMs: z.number().int().min(0).max(600_000),
}).strict();

const snapshotSchema = z.object({
  capturedAt: z.string().datetime({ offset: true, message: 'Captured time must be an ISO date-time' }),
}).strict();

const persistenceOperationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('twin_update'), data: twinDimensionsSchema }).strict(),
  z.object({ type: z.literal('risk_assessment'), data: riskAssessmentSchema }).strict(),
  z.object({ type: z.literal('agent_log'), data: agentLogSchema }).strict(),
  z.object({ type: z.literal('study_plan'), data: StudyPlanOutputSchema }).strict(),
  z.object({ type: z.literal('snapshot'), data: snapshotSchema }).strict(),
]);

export const InternalPersistencePayloadSchema = z.object({
  studentId: idString,
  runId: z.string().uuid('Run ID must be a UUID'),
  degraded: z.boolean(),
  operations: z.array(persistenceOperationSchema).min(1, 'At least one persistence operation is required').max(50, 'At most 50 persistence operations are allowed'),
}).strict();

export const InternalServiceTokenHeaderSchema = z.object({
  'x-internal-service-token': z.string().min(32, 'Internal service token must be at least 32 characters'),
}).strict();
