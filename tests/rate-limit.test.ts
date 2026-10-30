import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit, resetRateLimit, _rateLimitStoreSize } from '../src/lib/auth/rate-limit';

const MIN = 60_000;
mock.timers.enable({ apis: ['Date'], now: 1_000_000 });

test('default limit is unchanged: 5 allowed, the 6th blocked for the 15-minute window', () => {
  const r = Array.from({ length: 6 }, () => checkRateLimit('k-default'));
  assert.deepEqual(r.map((x) => x.allowed), [true, true, true, true, true, false]);
  assert.equal(r[4].remainingAttempts, 0);
  assert.equal(r[5].retryAfterMs, 15 * MIN);
});

test('a blocked key stays blocked until the window passes, then is allowed again', () => {
  mock.timers.tick(14 * MIN);
  assert.equal(checkRateLimit('k-default').allowed, false);
  mock.timers.tick(2 * MIN);
  assert.equal(checkRateLimit('k-default').allowed, true);
});

test('per-call options: a custom max and window apply, and keys are independent', () => {
  const opts = { max: 3, windowMs: 1000 };
  assert.deepEqual([1, 2, 3, 4].map(() => checkRateLimit('k-custom', opts).allowed), [true, true, true, false]);
  assert.equal(checkRateLimit('k-other', opts).allowed, true);
  mock.timers.tick(1001);
  assert.equal(checkRateLimit('k-custom', opts).allowed, true);
});

test('resetRateLimit clears a key immediately', () => {
  for (let i = 0; i < 6; i++) checkRateLimit('k-reset');
  assert.equal(checkRateLimit('k-reset').allowed, false);
  resetRateLimit('k-reset');
  assert.equal(checkRateLimit('k-reset').allowed, true);
});

test('EVICTION: thousands of distinct keys do not accumulate once their windows have passed', () => {
  for (let i = 0; i < 2000; i++) checkRateLimit(`flood-${i}`);
  assert.ok(_rateLimitStoreSize() >= 2000);
  mock.timers.tick(16 * MIN);
  checkRateLimit('trigger-sweep');
  assert.equal(_rateLimitStoreSize(), 1, 'only the fresh key should remain');
});

test('EVICTION keeps keys that are still blocked', () => {
  for (let i = 0; i < 6; i++) checkRateLimit('still-blocked');
  mock.timers.tick(5 * MIN);
  for (let i = 0; i < 3; i++) checkRateLimit(`noise-${i}`);
  mock.timers.tick(2 * MIN);                 // past a sweep interval, but the block (15 min) is still active
  checkRateLimit('trigger-2');
  assert.equal(checkRateLimit('still-blocked').allowed, false);
});
