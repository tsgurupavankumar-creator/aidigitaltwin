export type AgentType = 'LEARNING_ANALYSIS' | 'ATTENDANCE_RISK' | 'KNOWLEDGE_GAP';

export type StudentEvent =
  | 'quiz_attempted'
  | 'assignment_submitted'
  | 'attendance_marked'
  | 'weekly_review'
  | 'manual_trigger';

export interface LearningPrediction {
  nextExamScore: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  confidence: number;
  topWeakConcepts: string[];
  topStrongConcepts: string[];
}

export interface AttendancePrediction {
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

export interface OrchestrationResult {
  results: AgentResult[];
  intervention: Intervention;
  persistedInterventionId?: string;
  executedAt: Date;
}
