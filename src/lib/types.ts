export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AgentStatus = 'ACTIVE' | 'WAITING' | 'PROCESSING' | 'COMPLETED';
export type UserRole = 'student' | 'faculty' | 'STUDENT' | 'TEACHER';


export interface Account {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  name: string;
  studentId?: string;
  createdAt: string;
}

export interface Student {
  id: string;
  name: string;
  academicHealth: number;
  riskLevel: RiskLevel;
  attendance: number;
  engagement: number;
  learningVelocity: number;
  gpa: number;
  predictedGpa: number;
  performance?: number;
  gaps?: number;
  lastActivity?: string;
}

export interface KnowledgeGap {
  id: string;
  concept: string;
  subject?: string;
  mastery: number;
  previousMastery: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
}

export interface StudyTask {
  id: string;
  title: string;
  description?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate: string;
  completed: boolean;
  estimatedTime: number;
  time?: number;
  subject?: string;
}

export interface Alert {
  id: string;
  type: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  timestamp: string;
  time?: string;
  dismissed: boolean;
  resolved?: boolean;
  rootCause?: string;
  remediation?: {
    actionName: string;
    description: string;
    impactEstimate: string;
  };
}

export interface Agent {
  id: string;
  name: string;
  icon: string;
  status: AgentStatus;
  currentTask: string;
  task?: string;
  lastRun: string;
  priority: number;
  progress?: number;
  mode?: 'Autonomous' | 'Supervised';
  frequency?: string;
  logs?: { timestamp: string; message: string; type?: 'info' | 'warn' | 'success' }[];
}

export interface Recommendation {
  id: string;
  agentId?: string;
  title: string;
  description: string;
  action: string;
  confidence: number;
  impact?: 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL';
  category?: string;
  timeToComplete?: string;
  dismissed?: boolean;
  applied?: boolean;
  targetTopic?: string;
}

export interface TwinNode {
  label: string;
  value: number;
  icon: string;
  status: 'Good' | 'Medium' | 'Critical';
  description: string;
  subFactors?: { name: string; score: number }[];
}

export interface MetricItem {
  label: string;
  value: number;
  change: number;
  history?: number[];
  details?: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  subject: string;
  section?: string;
  term: string;
  schedule?: string;
  color: string;
  studentIds: string[];
  createdAt: string;
}

export interface Intervention {
  id: string;
  studentId: string;
  studentName: string;
  riskLevel: RiskLevel;
  type: 'TUTORING' | 'COUNSELING' | 'QUIZ' | 'MEETING';
  title: string;
  description: string;
  status: 'PENDING' | 'DISPATCHED' | 'COMPLETED';
  suggestedAction: string;
  date: string;
}
