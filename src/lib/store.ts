import { create } from 'zustand';
import { Student, KnowledgeGap, StudyTask, Alert, Agent, Recommendation, Intervention, Course, TwinNode, MetricItem } from './types';
import {
  mockStudent,
  mockStudentsList,
  mockKnowledgeGaps,
  mockStudyTasks,
  mockAlerts,
  mockAgents,
  mockRecommendations,
  mockInterventions,
  mockCourses,
} from '@/data/mockData';
import { getSession, logout as authLogout, Session } from './auth';

const COURSE_SUBJECT_PREFIXES: Record<string, string> = {
  'Computer Science': 'CS',
  'Mathematics': 'MATH',
  'Physics': 'PHY',
  'Chemistry': 'CHEM',
  'Biology': 'BIO',
  'English': 'ENG',
  'History': 'HIST',
  'Economics': 'ECO',
};

const COURSE_CARD_COLORS = ['#8B5CF6', '#22D3EE', '#F59E0B', '#10B981', '#EC4899', '#3B82F6'];

function slugPrefix(subject: string): string {
  const mapped = COURSE_SUBJECT_PREFIXES[subject];
  if (mapped) return mapped;
  const cleaned = subject.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return (cleaned.slice(0, 4) || 'CRS');
}

function generateCourseCode(subject: string, existingCodes: Set<string>): string {
  const prefix = slugPrefix(subject);
  let code = '';
  do {
    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    code = `${prefix}-${random}`;
  } while (existingCodes.has(code));
  return code;
}

function makeStudentId(existing: Student[]): string {
  const numericIds = existing
    .map((s) => parseInt(s.id, 10))
    .filter((n) => !Number.isNaN(n));
  const next = (numericIds.length ? Math.max(...numericIds) : 0) + 1;
  return String(next);
}

export const initialNodes: TwinNode[] = [
  {
    label: 'Academic',
    value: 84,
    icon: '📚',
    status: 'Good',
    description: 'Overall course evaluation & GPA trajectory',
    subFactors: [
      { name: 'Cumulative GPA Equivalent', score: 86 },
      { name: 'Midterm Weight Trajectory', score: 82 },
      { name: 'Syllabus Coverage Velocity', score: 85 },
    ],
  },
  {
    label: 'Attendance',
    value: 87,
    icon: '✅',
    status: 'Good',
    description: 'Class check-ins & lab sessions',
    subFactors: [
      { name: 'Lecture Attendance', score: 90 },
      { name: 'Mandatory Lab Check-ins', score: 84 },
    ],
  },
  {
    label: 'Knowledge',
    value: 71,
    icon: '🧠',
    status: 'Medium',
    description: 'Concept mastery & quiz vector retention',
    subFactors: [
      { name: 'DBMS Normalization Retention', score: 42 },
      { name: 'OS Deadlock Logic Recall', score: 51 },
      { name: 'CN Transport Protocol Mastery', score: 88 },
    ],
  },
  {
    label: 'Engagement',
    value: 76,
    icon: '🎯',
    status: 'Medium',
    description: 'LMS activity, forum posts & peer collaboration',
    subFactors: [
      { name: 'Discussion Forum Contributions', score: 72 },
      { name: 'Practice Problem Submissions', score: 80 },
    ],
  },
  {
    label: 'Behaviour',
    value: 82,
    icon: '📊',
    status: 'Good',
    description: 'Submission timeliness & consistency',
    subFactors: [
      { name: 'On-Time Assignment Submissions', score: 88 },
      { name: 'Regular Study Spacing Index', score: 76 },
    ],
  },
  {
    label: 'Skills',
    value: 79,
    icon: '💡',
    status: 'Good',
    description: 'Practical coding & problem solving capabilities',
    subFactors: [
      { name: 'SQL Query Optimization', score: 84 },
      { name: 'C/C++ POSIX Thread Coding', score: 74 },
    ],
  },
];

export const initialMetrics: MetricItem[] = [
  { label: 'Performance', value: 84, change: 8, history: [76, 78, 80, 81, 82, 83, 84], details: 'Assessment trajectory & examination scores' },
  { label: 'Attendance', value: 87, change: 3, history: [82, 84, 85, 86, 86, 87, 87], details: 'Lecture check-ins and lab attendance' },
  { label: 'Engagement', value: 76, change: -2, history: [80, 79, 78, 77, 77, 76, 76], details: 'LMS participation, quizzes, and discussion posts' },
  { label: 'Learning Velocity', value: 81, change: 5, history: [74, 75, 77, 78, 79, 80, 81], details: 'Concept mastery acquisition rate over time' },
];

const enrichedInitialAgents: Agent[] = mockAgents.map((agent, i) => ({
  ...agent,
  progress: [78, 92, 45, 100, 84][i % 5],
  mode: (i % 2 === 0 ? 'Autonomous' : 'Supervised') as 'Autonomous' | 'Supervised',
  frequency: ['Real-time', 'Continuous', 'Every 15m', 'On-Demand', 'Hourly'][i % 5],
  logs: [
    { timestamp: '18:28:10', message: `Initialized agent telemetry monitoring: ${agent.name}`, type: 'info' },
    { timestamp: '18:29:45', message: `Synchronized parameters with digital twin state`, type: 'info' },
    { timestamp: '18:31:00', message: `Active telemetry confirmed healthy. Status: ${agent.status}`, type: 'success' },
  ],
}));

const enrichedInitialAlerts: Alert[] = mockAlerts.map((alert) => ({
  ...alert,
  resolved: false,
  rootCause: alert.type === 'CRITICAL'
    ? 'Significant concept degradation in foundational prerequisite modules.'
    : 'Negative vector drift identified in recent assessments or check-ins.',
  remediation: {
    actionName: `Remediate ${alert.title}`,
    description: 'Launch an AI-guided targeted review block to reinforce vector deficit.',
    impactEstimate: '+8% Projected Health Score Improvement',
  },
}));

const enrichedInitialRecommendations: Recommendation[] = mockRecommendations.map((rec) => ({
  ...rec,
  timeToComplete: '15 mins',
  dismissed: false,
  applied: false,
  targetTopic: rec.title.split(' ')[0] || 'General',
}));

interface AppState {
  // Auth State
  session: Session | null;
  setSession: (session: Session | null) => void;
  logout: () => void;

  // Student State
  currentStudent: Student;
  knowledgeGaps: KnowledgeGap[];
  tasks: StudyTask[];
  alerts: Alert[];
  agents: Agent[];
  recommendations: Recommendation[];

  // Interactive Digital Twin & Vector State
  health: number;
  status: string;
  trend: number;
  metrics: MetricItem[];
  nodes: TwinNode[];
  
  // Faculty State
  students: Student[];
  interventions: Intervention[];
  selectedRiskFilter: string;
  searchTerm: string;
  courses: Course[];

  // Student Actions
  toggleTaskCompleted: (id: string) => void;
  addTask: (task: Omit<StudyTask, 'id'>) => void;
  deleteTask: (id: string) => void;
  dismissAlert: (id: string) => void;
  resolveAlert: (id: string) => void;
  restoreAlert: (id: string) => void;
  addAlert: (alert: Alert) => void;
  triggerAgentRun: (id: string) => void;
  toggleAgentPause: (id: string) => void;
  sendAgentDirective: (id: string, directive: string) => void;
  runAllAgents: () => void;
  updateHealth: (delta: number) => void;
  setMetricBoost: (label: string, boost: number) => void;
  dismissRecommendation: (id: string) => void;
  applyRecommendation: (id: string) => void;
  restoreRecommendation: (id: string) => void;
  generateRecommendations: () => void;
  updateNodeValue: (label: string, value: number) => void;
  resetNodes: () => void;

  // Faculty Actions
  setSearchTerm: (term: string) => void;
  setRiskFilter: (filter: string) => void;
  dispatchIntervention: (id: string) => void;

  // Course Actions
  createCourse: (input: {
    name: string;
    subject: string;
    section?: string;
    term: string;
    schedule?: string;
  }) => Course;
  deleteCourse: (courseId: string) => void;
  regenerateCourseCode: (courseId: string) => void;
  addStudentToCourse: (courseId: string, name: string) => void;
  addStudentsToCourseBulk: (courseId: string, names: string[]) => number;
  removeStudentFromCourse: (courseId: string, studentId: string) => void;
  joinCourseByCode: (code: string, studentId: string) => Course | null;
}

export const useAppStore = create<AppState>((set, get) => ({
  session: null,
  setSession: (session) => set({ session }),
  logout: () => {
    authLogout();
    set({ session: null });
  },

  currentStudent: mockStudent,
  knowledgeGaps: mockKnowledgeGaps,
  tasks: mockStudyTasks,
  alerts: enrichedInitialAlerts,
  agents: enrichedInitialAgents,
  recommendations: enrichedInitialRecommendations,
  health: 82,
  status: 'GOOD',
  trend: 6,
  metrics: initialMetrics,
  nodes: initialNodes,

  students: mockStudentsList,
  interventions: mockInterventions,
  selectedRiskFilter: 'All',
  searchTerm: '',
  courses: mockCourses,

  updateHealth: (delta: number) => {
    set((state) => {
      const nextHealth = Math.min(100, Math.max(0, state.health + delta));
      let nextStatus = 'GOOD';
      if (nextHealth < 50) nextStatus = 'CRITICAL';
      else if (nextHealth < 75) nextStatus = 'MEDIUM';
      else if (nextHealth >= 90) nextStatus = 'EXCELLENT';
      return {
        health: nextHealth,
        status: nextStatus,
        trend: state.trend + (delta > 0 ? 1 : -1),
      };
    });
  },

  setMetricBoost: (label: string, boost: number) => {
    set((state) => ({
      metrics: state.metrics.map((m) =>
        m.label === label
          ? { ...m, value: Math.min(100, m.value + boost), change: m.change + boost }
          : m
      ),
    }));
  },

  toggleTaskCompleted: (id: string) =>
    set((state) => {
      const task = state.tasks.find((t) => t.id === id);
      const willBeCompleted = !task?.completed;
      return {
        tasks: state.tasks.map((t) => (t.id === id ? { ...t, completed: willBeCompleted } : t)),
        health: willBeCompleted ? Math.min(100, state.health + 2) : state.health,
      };
    }),

  addTask: (taskData) => {
    const newTask: StudyTask = {
      ...taskData,
      id: `task-${Date.now()}`,
    };
    set((state) => ({
      tasks: [newTask, ...state.tasks],
    }));
  },

  deleteTask: (id: string) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }));
  },

  dismissAlert: (id: string) =>
    set((state) => ({
      alerts: state.alerts.map((alert) =>
        alert.id === id ? { ...alert, dismissed: true } : alert
      ),
    })),

  resolveAlert: (id: string) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, resolved: true, dismissed: true } : a)),
      health: Math.min(100, state.health + 3),
    })),

  restoreAlert: (id: string) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, dismissed: false, resolved: false } : a)),
    })),

  addAlert: (alert: Alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts],
    })),

  triggerAgentRun: (id: string) => {
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.id === id
          ? {
              ...agent,
              status: 'PROCESSING' as const,
              progress: 15,
              logs: [
                ...(agent.logs || []),
                { timestamp: new Date().toLocaleTimeString(), message: 'Manual execution triggered by user', type: 'info' as const },
              ],
            }
          : agent
      ),
    }));

    setTimeout(() => {
      set((state) => ({
        agents: state.agents.map((agent) =>
          agent.id === id
            ? {
                ...agent,
                status: 'ACTIVE' as const,
                progress: 100,
                lastRun: 'Just now',
                logs: [
                  ...(agent.logs || []),
                  { timestamp: new Date().toLocaleTimeString(), message: 'Execution complete. State vector updated.', type: 'success' as const },
                ],
              }
            : agent
        ),
      }));
    }, 2200);
  },

  toggleAgentPause: (id: string) => {
    set((state) => ({
      agents: state.agents.map((agent) => {
        if (agent.id === id) {
          const nextStatus = agent.status === 'WAITING' ? ('ACTIVE' as const) : ('WAITING' as const);
          return {
            ...agent,
            status: nextStatus,
            logs: [
              ...(agent.logs || []),
              {
                timestamp: new Date().toLocaleTimeString(),
                message: nextStatus === 'WAITING' ? 'Agent monitoring paused' : 'Agent monitoring resumed',
                type: 'warn' as const,
              },
            ],
          };
        }
        return agent;
      }),
    }));
  },

  sendAgentDirective: (id: string, directive: string) => {
    set((state) => ({
      agents: state.agents.map((agent) => {
        if (agent.id === id) {
          return {
            ...agent,
            currentTask: directive,
            task: directive,
            status: 'PROCESSING' as const,
            logs: [
              ...(agent.logs || []),
              { timestamp: new Date().toLocaleTimeString(), message: `Directive received: "${directive}"`, type: 'info' as const },
            ],
          };
        }
        return agent;
      }),
    }));

    setTimeout(() => {
      set((state) => ({
        agents: state.agents.map((agent) =>
          agent.id === id
            ? {
                ...agent,
                status: 'ACTIVE' as const,
                logs: [
                  ...(agent.logs || []),
                  { timestamp: new Date().toLocaleTimeString(), message: `Directive completed and synced: "${directive}"`, type: 'success' as const },
                ],
              }
            : agent
        ),
      }));
    }, 1800);
  },

  runAllAgents: () => {
    set((state) => ({
      agents: state.agents.map((a) => ({
        ...a,
        status: 'PROCESSING' as const,
        logs: [
          ...(a.logs || []),
          { timestamp: new Date().toLocaleTimeString(), message: 'Batch run initiated across all agents', type: 'info' as const },
        ],
      })),
    }));

    setTimeout(() => {
      set((state) => ({
        agents: state.agents.map((a) => ({
          ...a,
          status: 'ACTIVE' as const,
          lastRun: 'Just now',
          logs: [
            ...(a.logs || []),
            { timestamp: new Date().toLocaleTimeString(), message: 'Batch cycle completed successfully', type: 'success' as const },
          ],
        })),
      }));
    }, 2500);
  },

  dismissRecommendation: (id: string) =>
    set((state) => ({
      recommendations: state.recommendations.map((r) =>
        r.id === id ? { ...r, dismissed: true } : r
      ),
    })),

  applyRecommendation: (id: string) => {
    const rec = get().recommendations.find((r) => r.id === id);
    if (!rec) return;

    const newTask: StudyTask = {
      id: `task-from-rec-${Date.now()}`,
      title: `${rec.title}: ${rec.action}`,
      description: rec.description,
      priority: rec.impact === 'HIGH' ? 'HIGH' : rec.impact === 'MEDIUM' ? 'MEDIUM' : 'LOW',
      dueDate: 'Today, Next Focus Block',
      time: 20,
      estimatedTime: 20,
      completed: false,
      subject: rec.targetTopic || 'General',
    };

    set((state) => ({
      recommendations: state.recommendations.map((r) =>
        r.id === id ? { ...r, applied: true, dismissed: true } : r
      ),
      tasks: [newTask, ...state.tasks],
      health: Math.min(100, state.health + 3),
    }));
  },

  restoreRecommendation: (id: string) =>
    set((state) => ({
      recommendations: state.recommendations.map((r) =>
        r.id === id ? { ...r, dismissed: false, applied: false } : r
      ),
    })),

  generateRecommendations: () => {
    const freshRec: Recommendation = {
      id: `rec-${Date.now()}`,
      title: 'Operating System Memory Thrashing Diagnostic',
      description: 'Recent page fault velocity indicates difficulty differentiating Working Set Model vs Page-Fault Frequency.',
      impact: 'HIGH',
      confidence: 92,
      action: 'Launch 10m Visualizer Drill',
      category: 'REMEDIAL',
      timeToComplete: '10 mins',
      dismissed: false,
      applied: false,
      targetTopic: 'Operating Systems',
    };
    set((state) => ({
      recommendations: [freshRec, ...state.recommendations],
    }));
  },

  updateNodeValue: (label: string, value: number) => {
    set((state) => {
      const newNodes = state.nodes.map((node) =>
        node.label === label ? { ...node, value } : node
      );
      const avg = Math.round(newNodes.reduce((acc, n) => acc + n.value, 0) / newNodes.length);
      return {
        nodes: newNodes,
        health: avg,
      };
    });
  },

  resetNodes: () => {
    set(() => ({
      nodes: initialNodes,
      health: 82,
    }));
  },

  setSearchTerm: (term: string) => set({ searchTerm: term }),
  setRiskFilter: (filter: string) => set({ selectedRiskFilter: filter }),
  dispatchIntervention: (id: string) =>
    set((state) => ({
      interventions: state.interventions.map((inv) =>
        inv.id === id ? { ...inv, status: 'DISPATCHED' as const } : inv
      ),
    })),

  createCourse: (input) => {
    const state = get();
    const existingCodes = new Set(state.courses.map((c) => c.code));
    const code = generateCourseCode(input.subject, existingCodes);
    const color = COURSE_CARD_COLORS[state.courses.length % COURSE_CARD_COLORS.length];
    const newCourse: Course = {
      id: `course-${Date.now()}`,
      name: input.name,
      code,
      subject: input.subject,
      section: input.section,
      term: input.term,
      schedule: input.schedule,
      color,
      studentIds: [],
      createdAt: new Date().toISOString().slice(0, 10),
    };
    set({ courses: [...state.courses, newCourse] });
    return newCourse;
  },

  deleteCourse: (courseId: string) =>
    set((state) => ({
      courses: state.courses.filter((c) => c.id !== courseId),
    })),

  regenerateCourseCode: (courseId: string) =>
    set((state) => {
      const existingCodes = new Set(state.courses.map((c) => c.code));
      return {
        courses: state.courses.map((c) => {
          if (c.id !== courseId) return c;
          existingCodes.delete(c.code);
          return { ...c, code: generateCourseCode(c.subject, existingCodes) };
        }),
      };
    }),

  addStudentToCourse: (courseId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((state) => {
      let students = state.students;
      let studentId: string;
      const existingByName = students.find(
        (s) => s.name.toLowerCase() === trimmed.toLowerCase()
      );

      if (existingByName) {
        studentId = existingByName.id;
      } else {
        studentId = makeStudentId(students);
        const stub: Student = {
          id: studentId,
          name: trimmed,
          academicHealth: 75,
          riskLevel: 'MEDIUM',
          attendance: 100,
          engagement: 70,
          learningVelocity: 70,
          gpa: 0,
          predictedGpa: 0,
          performance: 0,
          gaps: 0,
          lastActivity: 'Not yet active',
        };
        students = [...students, stub];
      }

      const courses = state.courses.map((c) =>
        c.id === courseId && !c.studentIds.includes(studentId)
          ? { ...c, studentIds: [...c.studentIds, studentId] }
          : c
      );

      return { students, courses };
    });
  },

  addStudentsToCourseBulk: (courseId: string, names: string[]) => {
    const cleanNames = names.map((n) => n.trim()).filter(Boolean);
    let addedCount = 0;
    set((state) => {
      let students = [...state.students];
      const newIds: string[] = [];

      for (const name of cleanNames) {
        const existingByName = students.find(
          (s) => s.name.toLowerCase() === name.toLowerCase()
        );
        if (existingByName) {
          newIds.push(existingByName.id);
          continue;
        }
        const studentId = makeStudentId(students);
        const stub: Student = {
          id: studentId,
          name,
          academicHealth: 75,
          riskLevel: 'MEDIUM',
          attendance: 100,
          engagement: 70,
          learningVelocity: 70,
          gpa: 0,
          predictedGpa: 0,
          performance: 0,
          gaps: 0,
          lastActivity: 'Not yet active',
        };
        students.push(stub);
        newIds.push(studentId);
      }

      const courses = state.courses.map((c) => {
        if (c.id !== courseId) return c;
        const merged = Array.from(new Set([...c.studentIds, ...newIds]));
        addedCount = merged.length - c.studentIds.length;
        return { ...c, studentIds: merged };
      });

      return { students, courses };
    });
    return addedCount;
  },

  removeStudentFromCourse: (courseId: string, studentId: string) =>
    set((state) => ({
      courses: state.courses.map((c) =>
        c.id === courseId
          ? { ...c, studentIds: c.studentIds.filter((id) => id !== studentId) }
          : c
      ),
    })),

  joinCourseByCode: (code: string, studentId: string) => {
    const state = get();
    const match = state.courses.find(
      (c) => c.code.toLowerCase() === code.trim().toLowerCase()
    );
    if (!match) return null;
    set({
      courses: state.courses.map((c) =>
        c.id === match.id && !c.studentIds.includes(studentId)
          ? { ...c, studentIds: [...c.studentIds, studentId] }
          : c
      ),
    });
    return match;
  },
}));
