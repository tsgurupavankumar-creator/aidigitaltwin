import { z } from 'zod';

export type AgentType = 'LEARNING_ANALYSIS' | 'ATTENDANCE_RISK' | 'KNOWLEDGE_GAP';

export const llmActionTypeSchema = z.enum(['STUDY', 'REVIEW', 'PRACTICE', 'TUTORING']);
export const llmFacultyActionSchema = z.enum(['NONE', 'TUTORING', 'COUNSELING', 'QUIZ', 'MEETING']);

export const llmStudyTaskSchema = z.object({
  conceptAlias: z.string().regex(/^C[1-9]\d*$/),
  title: z.string().trim().min(1).max(160),
  reason: z.string().trim().min(1).max(240),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  estimatedMins: z.number().int().min(10).max(60),
}).strict();

export const llmActionPlanSchema = z.object({
  actionType: llmActionTypeSchema,
  facultyAction: llmFacultyActionSchema,
  facultyNote: z.string().trim().max(500),
  tasks: z.array(llmStudyTaskSchema).min(1).max(3),
}).strict();

export type LLMActionType = z.infer<typeof llmActionTypeSchema>;
export type LLMFacultyAction = z.infer<typeof llmFacultyActionSchema>;
export type LLMStudyTask = z.infer<typeof llmStudyTaskSchema>;
export type LLMActionPlan = z.infer<typeof llmActionPlanSchema>;

export type StudentEvent =
  | 'quiz_attempted'
  | 'assignment_submitted'
  | 'attendance_marked'
  | 'weekly_review'
  | 'study_plan_updated'
  | 'manual_trigger';

/** One feature behind a prediction: its value and how much it moved the prediction. */
export interface PredictionReason {
  feature: string;
  value: number | null;
  effect: number;
}

export interface LearningPrediction {
  nextExamScore: number;
  /** 80% range from validation errors (null for older models). */
  range?: { low: number; high: number } | null;
  /** Features that moved this prediction most (up or down). */
  reasons?: PredictionReason[];
  /** Which trained model made it, for traceability. */
  modelVersion?: string | null;
  modelUsed: 'trained' | 'fallback';
  trend: 'UP' | 'DOWN' | 'STABLE';
  confidence: number;
  topWeakConcepts: string[];
  topStrongConcepts: string[];
}

export interface AttendancePrediction {
  modelUsed: 'trained' | 'fallback';
  /** Features that pushed this student's risk up most. */
  reasons?: PredictionReason[];
  /** Which trained model made it, for traceability. */
  modelVersion?: string | null;
  atRisk: boolean;
  riskScore: number;
  currentAttendance: number;
  projectedAttendance: number;
  daysUntilCritical: number;
  confidence: number;
}

export interface KnowledgeGap {
  conceptId: string;
  conceptName: string;
  mastery: number;
  rootCause: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  downstreamConcepts: string[];
}

export interface KnowledgeGapPrediction {
  criticalGaps: KnowledgeGap[];
  overallGapScore: number;
  confidence: number;
}

export type AgentPrediction = LearningPrediction | AttendancePrediction | KnowledgeGapPrediction;

export interface AgentResult {
  agentType: AgentType;
  studentId: string;
  prediction: AgentPrediction;
  reasoning: string;
  recommendedAction: string;
  confidence: number;
  executedAt: Date;
}

export interface Intervention {
  flags: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  studentId: string;
  recommendedActions: string[];
  shouldEscalateToFaculty: boolean;
  triggeredAt: Date;
}

export interface AgentError {
  agent: string;
  message: string;
}

export interface OrchestrationResult {
  results: AgentResult[];
  intervention: Intervention;
  persistedInterventionId?: string;
  executedAt: Date;
  /** True only when a predictive agent failed, in which case NOTHING was saved. An optional-LLM fallback is reported in `llm` instead. */
  degraded?: boolean;
  agentErrors?: AgentError[];
  /** True when this response replays an earlier completed run from the same hour. */
  replayed?: boolean;
  /** Optional LLM recommendation-stage diagnostics; predictions and risk are unchanged. */
  llm?: { enabled: boolean; used: boolean; degraded: boolean; audit: { model: string; promptVersion: string; outcome: string; itemCount: number } };
}
