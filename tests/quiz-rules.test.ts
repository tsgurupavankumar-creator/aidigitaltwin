import test from 'node:test';
import assert from 'node:assert/strict';
process.env.JWT_SECRET ||= 'test-secret-value-that-is-long-enough-1234567890';
import { availability, startToken, verifyStart, withinTime, GRACE_MS } from '../src/lib/twin/quiz-rules';

const base = { durationMins: 10, maxAttempts: null, opensAt: null, closesAt: null, isClosed: false };
const now = new Date('2026-10-29T10:00:00Z');

test('availability: closed, not open yet, attempts used up, or open', () => {
  assert.equal(availability({ ...base, isClosed: true }, 0, now).reason, 'CLOSED');
  assert.equal(availability({ ...base, closesAt: new Date('2026-10-29T09:00:00Z') }, 0, now).reason, 'CLOSED');
  assert.equal(availability({ ...base, opensAt: new Date('2026-10-29T11:00:00Z') }, 0, now).reason, 'NOT_OPEN_YET');
  assert.equal(availability({ ...base, maxAttempts: 2 }, 2, now).reason, 'NO_ATTEMPTS_LEFT');
  const ok = availability({ ...base, maxAttempts: 3 }, 1, now);
  assert.deepEqual([ok.open, ok.attemptsLeft], [true, 2]);
  assert.equal(availability(base, 50, now).attemptsLeft, null, 'unlimited');
});

test('start token: genuine only for the same quiz and student; tampering fails', () => {
  const t = startToken('q1', 's1', 1_000_000);
  assert.equal(verifyStart(t, 'q1', 's1'), 1_000_000);
  assert.equal(verifyStart(t, 'q2', 's1'), null, 'another quiz');
  assert.equal(verifyStart(t, 'q1', 's2'), null, 'another student');
  assert.equal(verifyStart(t.replace('1000000', '1900000'), 'q1', 's1'), null, 'moved start time');
  assert.equal(verifyStart(undefined, 'q1', 's1'), null);
});

test('time limit: duration plus a 60 s grace, no more', () => {
  const start = 1_000_000;
  assert.ok(withinTime(start, 10, start + 10 * 60_000 + GRACE_MS));
  assert.ok(!withinTime(start, 10, start + 10 * 60_000 + GRACE_MS + 1));
  assert.ok(!withinTime(start, 10, start - 1), 'a start time in the future is refused');
});
