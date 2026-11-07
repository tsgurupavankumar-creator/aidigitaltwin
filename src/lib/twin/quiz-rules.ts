import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Quiz rules, all enforced on the server:
 *  - availability: open/close times, closed by faculty, attempts left
 *  - time limit: a signed start time is issued when the quiz is opened; an attempt submitted later
 *    than duration + 60 s grace is refused (the on-screen timer cannot be bypassed)
 */
export interface QuizRules { durationMins: number; maxAttempts: number | null; opensAt: Date | null; closesAt: Date | null; isClosed: boolean }
export type Unavailable = 'CLOSED' | 'NOT_OPEN_YET' | 'NO_ATTEMPTS_LEFT';
export const GRACE_MS = 60_000;

export function availability(q: QuizRules, attemptsUsed: number, now = new Date()) {
  const attemptsLeft = q.maxAttempts === null ? null : Math.max(0, q.maxAttempts - attemptsUsed);
  let reason: Unavailable | null = null;
  if (q.isClosed || (q.closesAt && now > q.closesAt)) reason = 'CLOSED';
  else if (q.opensAt && now < q.opensAt) reason = 'NOT_OPEN_YET';
  else if (attemptsLeft === 0) reason = 'NO_ATTEMPTS_LEFT';
  return { open: reason === null, reason, attemptsLeft };
}

export function unavailableMessage(reason: Unavailable, q: Pick<QuizRules, 'opensAt'>) {
  if (reason === 'CLOSED') return 'This quiz is closed.';
  if (reason === 'NOT_OPEN_YET') return `This quiz opens ${q.opensAt?.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}.`;
  return 'You have used all your attempts for this quiz.';
}

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}
const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

/** Token proving when this student opened this quiz. */
export function startToken(quizId: string, studentId: string, startedAt = Date.now()) {
  const payload = `${quizId}.${studentId}.${startedAt}`;
  return `${startedAt}.${sign(payload)}`;
}

/** Returns the start time if the token is genuine for this quiz and student, else null. */
export function verifyStart(token: unknown, quizId: string, studentId: string): number | null {
  if (typeof token !== 'string') return null;
  const [ts, mac] = token.split('.');
  const startedAt = Number(ts);
  if (!Number.isFinite(startedAt) || !mac) return null;
  const expected = Buffer.from(sign(`${quizId}.${studentId}.${startedAt}`));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given) ? startedAt : null;
}

export function withinTime(startedAt: number, durationMins: number, now = Date.now()) {
  return now >= startedAt && now <= startedAt + durationMins * 60_000 + GRACE_MS;
}
