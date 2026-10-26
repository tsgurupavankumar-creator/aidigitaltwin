import type { Prisma, PrismaClient } from '@prisma/client';
import { isAtRiskLevel } from '@/lib/risk/at-risk';

export const COURSE_SUMMARY = 'COURSE_SUMMARY';
const WEAK_MASTERY = 70;

export interface InsightStudent {
  twin: { academicHealth: number; attendanceScore: number; knowledgeScore: number; performanceScore: number } | null;
  latestRiskLevel: string | null;
  /** This student's attendance records for THIS course's lectures. */
  attendanceStatuses: string[];
}

export interface InsightConcept {
  id: string;
  name: string;
  /** Mastery scores of enrolled students who have a record for this concept. */
  scores: number[];
}

export interface CourseSummary {
  studentCount: number;
  studentsWithTwin: number;
  averages: { academicHealth: number | null; knowledge: number | null; performance: number | null };
  courseAttendanceRate: number | null;
  lecturesRecorded: number;
  riskDistribution: { LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number; NOT_ASSESSED: number };
  atRiskCount: number;
  weakestConcepts: Array<{ conceptId: string; name: string; averageMastery: number; studentsBelow70: number; studentsAssessed: number }>;
  generatedAt: string;
}

const mean = (values: number[]) => (values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null);

/** Pure aggregation. Missing data stays null or is counted as NOT_ASSESSED, never invented. */
export function summarizeCourse(students: InsightStudent[], concepts: InsightConcept[], lecturesRecorded: number, now = new Date()): CourseSummary {
  const twins = students.flatMap((s) => (s.twin ? [s.twin] : []));
  const risk = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0, NOT_ASSESSED: 0 };
  for (const s of students) {
    const level = s.latestRiskLevel as keyof typeof risk | null;
    if (level && level in risk && level !== 'NOT_ASSESSED') risk[level] += 1;
    else risk.NOT_ASSESSED += 1;
  }
  const statuses = students.flatMap((s) => s.attendanceStatuses);
  const attended = statuses.filter((st) => st === 'PRESENT' || st === 'LATE').length;
  const weakestConcepts = concepts
    .filter((c) => c.scores.length > 0)
    .map((c) => ({
      conceptId: c.id,
      name: c.name,
      averageMastery: mean(c.scores)!,
      studentsBelow70: c.scores.filter((v) => v < WEAK_MASTERY).length,
      studentsAssessed: c.scores.length,
    }))
    .sort((a, b) => a.averageMastery - b.averageMastery)
    .slice(0, 5);
  return {
    studentCount: students.length,
    studentsWithTwin: twins.length,
    averages: {
      academicHealth: mean(twins.map((t) => t.academicHealth)),
      knowledge: mean(twins.map((t) => t.knowledgeScore)),
      performance: mean(twins.map((t) => t.performanceScore)),
    },
    courseAttendanceRate: statuses.length ? Math.round((1000 * attended) / statuses.length) / 10 : null,
    lecturesRecorded,
    riskDistribution: risk,
    atRiskCount: students.filter((s) => isAtRiskLevel(s.latestRiskLevel)).length,
    weakestConcepts,
    generatedAt: now.toISOString(),
  };
}

type Db = PrismaClient | Prisma.TransactionClient;

/** Recomputes and stores the COURSE_SUMMARY insight for one course. Returns null if the course has no faculty. */
export async function refreshCourseInsight(db: Db, courseId: string): Promise<CourseSummary | null> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      facultyId: true,
      _count: { select: { lectures: true } },
      concepts: { select: { id: true, name: true } },
      enrollments: {
        select: {
          student: {
            select: {
              id: true,
              digitalTwin: { select: { academicHealth: true, attendanceScore: true, knowledgeScore: true, performanceScore: true } },
              riskAssessments: { orderBy: { createdAt: 'desc' }, take: 1, select: { riskLevel: true } },
              attendance: { where: { lecture: { courseId } }, select: { status: true } },
            },
          },
        },
      },
    },
  });
  if (!course || !course.facultyId) return null;

  const studentIds = course.enrollments.map((e) => e.student.id);
  const mastery = studentIds.length && course.concepts.length
    ? await db.conceptMastery.findMany({
        where: { studentId: { in: studentIds }, conceptId: { in: course.concepts.map((c) => c.id) } },
        select: { conceptId: true, masteryScore: true },
      })
    : [];

  const summary = summarizeCourse(
    course.enrollments.map(({ student }) => ({
      twin: student.digitalTwin,
      latestRiskLevel: student.riskAssessments[0]?.riskLevel ?? null,
      attendanceStatuses: student.attendance.map((a) => a.status),
    })),
    course.concepts.map((c) => ({ id: c.id, name: c.name, scores: mastery.filter((m) => m.conceptId === c.id).map((m) => m.masteryScore) })),
    course._count.lectures
  );

  const existing = await db.classInsight.findFirst({ where: { courseId, insightType: COURSE_SUMMARY }, select: { id: true } });
  const data = summary as unknown as Prisma.InputJsonValue;
  if (existing) {
    await db.classInsight.update({ where: { id: existing.id }, data: { data, facultyId: course.facultyId } });
  } else {
    await db.classInsight.create({ data: { courseId, facultyId: course.facultyId, insightType: COURSE_SUMMARY, data } });
  }
  return summary;
}
