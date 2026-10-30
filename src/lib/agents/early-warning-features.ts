/**
 * The attendance / early-warning model's input, built as in training
 * (ml/oulad_features.py: online presence + assessed work known so far).
 * EXCUSED lectures are left out entirely: an excused absence is neither
 * attendance nor absence. earlyAvgScore is null when nothing has been scored
 * yet: unknown, never 0.
 */
import type { AssessedWork } from './assessed-work';

export type AttendanceStatusValue = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface EarlyWarningFeatures {
  currentAttendance: number;
  recentAttendance: number;
  attendanceCount: number;
  absenceRate: number;
  earlyAvgScore: number | null;
  earlyAssessedCount: number;
  earlyMissedCount: number;
  earlyLateCount: number;
  /** Attendance % minus the class's attendance % on the same lectures; null when unknown. */
  presenceVsClass: number | null;
  /** Marks minus the class average on the same work; null when unknown. */
  scoreVsClass: number | null;
}

/** statuses: oldest first. classAttendance: the class's attendance % on the same lectures (null when unknown). */
export function buildEarlyWarningFeatures(statuses: AttendanceStatusValue[], work: AssessedWork, classAttendance: number | null = null): EarlyWarningFeatures {
  const counted = statuses.filter((s) => s !== 'EXCUSED');
  const attended = (list: AttendanceStatusValue[]) => list.filter((s) => s === 'PRESENT' || s === 'LATE').length;
  const current = counted.length ? (100 * attended(counted)) / counted.length : 100;
  const recentHalf = counted.slice(Math.floor(counted.length / 2));
  const recent = recentHalf.length ? (100 * attended(recentHalf)) / recentHalf.length : current;
  const scores = work.scoresChronological;
  return {
    currentAttendance: current,
    recentAttendance: recent,
    attendanceCount: counted.length,
    absenceRate: counted.length ? 1 - current / 100 : 0,
    earlyAvgScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    earlyAssessedCount: scores.length,
    earlyMissedCount: work.missedCount,
    earlyLateCount: work.lateHandedInCount,
    presenceVsClass: counted.length && classAttendance !== null ? current - classAttendance : null,
    scoreVsClass: work.relativeToClass,
  };
}
