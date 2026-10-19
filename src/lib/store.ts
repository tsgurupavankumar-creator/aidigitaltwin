import { create } from 'zustand';
import { Student, KnowledgeGap, StudyTask, Alert, Agent, Recommendation, Intervention, Course, TwinNode, MetricItem } from './types';
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

interface AppState {
  // Auth State
  session: Session | null;
  setSession: (session: Session | null) => void;
  logout: () => void;
  hydrateFromApi: () => Promise<void>;
  dataLoading: boolean;
  dataError: string | null;

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

  hydrateFromApi: async () => {
    if (typeof window === 'undefined') return;
    const session = get().session || getSession();
    if (!session) return;

    set({ dataLoading: true, dataError: null });
    try {
      const getJson = async (url: string) => {
        const res = await fetch(url, { cache: 'no-store', credentials: 'include' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Request failed: ${res.status}`);
        return json;
      };

      if (session.role === 'student') {
        const [twinJson, gapsJson, riskJson, alertsJson, recJson, planJson, perfJson, logsJson] =
          await Promise.all([
            getJson('/api/student/twin'),
            getJson('/api/student/knowledge-gaps'),
            getJson('/api/student/risk'),
            getJson('/api/student/alerts'),
            getJson('/api/student/recommendations'),
            getJson('/api/student/study-plan'),
            getJson('/api/student/performance'),
            session.studentId ? getJson(`/api/agents/logs/${session.studentId}`) : Promise.resolve({}),
          ]);

        const twin = twinJson.data || {};
        const risk = riskJson.data || {};
        const performance = perfJson.data || {};
        const gaps = (gapsJson.data || []).map((g: any) => ({
          id: g.id,
          concept: g.concept?.name || g.conceptName || 'Unknown concept',
          subject: g.concept?.courseId || undefined,
          mastery: Math.round(g.masteryScore ?? g.mastery ?? 0),
          previousMastery: Math.round(g.previousScore ?? g.masteryScore ?? 0),
          trend: g.trend || 'STABLE',
        }));
        const alerts = (alertsJson.data || []).map((a: any) => ({
          id: a.id,
          type: a.severity === 'CRITICAL' ? 'CRITICAL' : a.severity === 'WARNING' ? 'WARNING' : 'INFO',
          title: a.type === 'ATTENDANCE' ? 'Attendance Risk' : a.type === 'QUIZ' ? 'Performance Alert' : 'Academic Recommendation',
          message: a.message,
          impact: a.severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
          timestamp: a.createdAt,
          time: a.createdAt ? new Date(a.createdAt).toLocaleString() : '',
          dismissed: Boolean(a.isRead),
          resolved: Boolean(a.isRead),
        }));
        const recommendations = (recJson.data || []).map((r: any) => ({
          id: r.id,
          agentId: r.agentType,
          title: r.title,
          description: 'Generated from the current digital-twin assessment.',
          action: r.actionType === 'REVIEW' ? 'Review the recommended area' : 'Complete targeted practice',
          confidence: Math.round((r.confidence ?? 0) * 100),
          impact: r.confidence >= 0.85 ? 'HIGH' : 'MEDIUM',
          category: r.agentType,
          dismissed: false,
          applied: false,
        }));
        const plan = planJson.data;
        const tasks = (plan?.tasks || []).map((t: any) => ({
          id: t.id,
          title: t.concept?.name ? `Practice ${t.concept.name}` : 'Study task',
          description: t.concept?.name ? `Targeted practice for ${t.concept.name}.` : undefined,
          priority: t.priority || 'MEDIUM',
          dueDate: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'Upcoming',
          completed: Boolean(t.completed),
          estimatedTime: t.estimatedMins || 30,
          time: t.estimatedMins || 30,
          subject: t.concept?.courseId || 'General',
        }));
        const metricValues = [
          ['Performance', twin.performanceScore],
          ['Attendance', twin.attendanceScore],
          ['Engagement', twin.engagementScore],
          ['Learning Velocity', Math.round((twin.learningVelocity ?? 0) * 100)],
        ].filter(([, value]) => typeof value === 'number');
        const metrics = metricValues.map(([label, value]) => ({
          label: String(label), value: Math.round(Number(value)), change: 0,
        }));
        const nodes = [
          ['Academic', twin.academicHealth, '📚', 'Overall academic health'],
          ['Attendance', twin.attendanceScore, '✅', 'Attendance and check-ins'],
          ['Knowledge', twin.knowledgeScore, '🧠', 'Concept mastery'],
          ['Engagement', twin.engagementScore, '🎯', 'Learning engagement'],
          ['Behaviour', twin.behaviorScore, '📊', 'Submission consistency'],
          ['Skills', twin.skillsScore, '💡', 'Practical skill development'],
        ].filter(([, value]) => typeof value === 'number').map(([label, value, icon, description]): TwinNode => ({
          label: String(label), value: Math.round(Number(value)), icon: String(icon),
          status: Number(value) >= 75 ? 'Good' : Number(value) >= 50 ? 'Medium' : 'Critical',
          description: String(description),
        }));
        const latestLogs = Array.isArray(logsJson) ? logsJson : [];
        const agentTypes = [
          ['learning', 'Learning Analysis Agent', 'LEARNING_ANALYSIS'],
          ['attendance', 'Attendance & Pattern Agent', 'ATTENDANCE_RISK'],
          ['knowledge', 'Knowledge Gap Agent', 'KNOWLEDGE_GAP'],
        ];
        const agents = agentTypes.map(([id, name, type], i) => {
          const log = latestLogs.find((l: any) => l.agentType === type);
          return {
            id, name, icon: ['🧠', '📊', '🔎'][i], status: 'ACTIVE' as const,
            currentTask: log?.output?.reasoning || 'Monitoring live student telemetry',
            task: log?.output?.recommendedAction || 'Waiting for the next trigger',
            lastRun: log?.createdAt ? new Date(log.createdAt).toLocaleString() : 'No run yet',
            priority: i + 1, progress: 100, mode: 'Autonomous' as const, frequency: 'Event driven',
            logs: log ? [{ timestamp: new Date(log.createdAt).toLocaleTimeString(), message: log.output?.reasoning || 'Agent completed', type: 'success' as const }] : [],
          };
        });
        const student = {
          id: session.studentId || session.id,
          name: session.name,
          academicHealth: Math.round(twin.academicHealth ?? performance.academicHealth ?? 0),
          riskLevel: risk.riskLevel || 'LOW',
          attendance: Math.round(twin.attendanceScore ?? 0),
          engagement: Math.round(twin.engagementScore ?? 0),
          learningVelocity: Math.round((twin.learningVelocity ?? 0) * 100),
          gpa: performance.cumulativeGpa ?? 0,
          predictedGpa: performance.predictedGpa ?? risk.predictedGPA ?? 0,
          performance: Math.round(twin.performanceScore ?? 0),
          gaps: gaps.length,
          lastActivity: twin.lastSyncedAt || 'Live',
        };
        set({
          currentStudent: student, knowledgeGaps: gaps, tasks, alerts, recommendations, agents,
          health: student.academicHealth, status: student.riskLevel, trend: 0, metrics, nodes,
          dataLoading: false, dataError: null,
        });
      } else {
        const [studentsJson, interventionsJson, coursesJson] = await Promise.all([
          getJson('/api/faculty/students'),
          getJson('/api/faculty/intervention'),
          getJson('/api/faculty/courses'),
        ]);
        const rawStudents = studentsJson.data || [];
        const students: Student[] = rawStudents.map((s: any): Student => {
          const risk = s.riskAssessments?.[0];
          return {
            id: s.id, name: s.fullName, academicHealth: Math.round(s.digitalTwin?.academicHealth ?? 0),
            riskLevel: risk?.riskLevel || 'LOW', attendance: Math.round(s.digitalTwin?.attendanceScore ?? 0),
            engagement: Math.round(s.digitalTwin?.engagementScore ?? 0), learningVelocity: Math.round((s.digitalTwin?.learningVelocity ?? 0) * 100),
            gpa: 0, predictedGpa: risk?.predictedGPA ?? 0, performance: Math.round(s.digitalTwin?.performanceScore ?? 0),
            gaps: 0, lastActivity: s.digitalTwin?.lastSyncedAt || 'Live',
          };
        });
        const riskByStudent = new Map<string, Student>(students.map((s) => [s.id, s] as [string, Student]));
        const interventions = (interventionsJson.data || []).map((i: any) => {
          const student = riskByStudent.get(i.studentId);
          return {
            id: i.id, studentId: i.studentId, studentName: i.student?.fullName || student?.name || 'Student',
            riskLevel: student?.riskLevel || 'MEDIUM', type: i.type, title: `${i.type} intervention`,
            description: i.notes, status: i.completedAt ? 'COMPLETED' : 'PENDING',
            suggestedAction: i.notes, date: i.createdAt ? new Date(i.createdAt).toLocaleDateString() : 'Recent',
          };
        });
        const courses = (coursesJson.data || []).map((c: any, index: number) => ({
          ...c, subject: c.department || 'Course', color: COURSE_CARD_COLORS[index % COURSE_CARD_COLORS.length],
          createdAt: c.createdAt || new Date().toISOString(),
        }));
        set({ students, interventions, courses, dataLoading: false, dataError: null });
      }
    } catch (error) {
      set({ dataLoading: false, dataError: error instanceof Error ? error.message : 'Unable to load live data' });
    }
  },

  currentStudent: { id: '', name: '', academicHealth: 0, riskLevel: 'LOW', attendance: 0, engagement: 0, learningVelocity: 0, gpa: 0, predictedGpa: 0 },
  knowledgeGaps: [],
  tasks: [],
  alerts: [],
  agents: [],
  recommendations: [],
  health: 0,
  status: 'UNKNOWN',
  trend: 0,
  metrics: [],
  nodes: [],
  students: [],
  interventions: [],
  selectedRiskFilter: 'All',
  searchTerm: '',
  courses: [],
  dataLoading: false,
  dataError: null,

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
    set((state) => {
      const nodes = state.nodes.map((node) => ({ ...node }));
      const health = nodes.length
        ? Math.round(nodes.reduce((sum, node) => sum + node.value, 0) / nodes.length)
        : 0;
      return { nodes, health };
    });
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
