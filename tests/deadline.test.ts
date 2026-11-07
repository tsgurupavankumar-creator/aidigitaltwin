import test from 'node:test';
import assert from 'node:assert/strict';
import { endOfDay, localDay } from '../src/lib/twin/deadline';

test('a due date is the end of that day in India, not UTC', () => {
  const due = endOfDay('2026-08-08');
  assert.equal(due.toISOString(), '2026-08-08T18:29:59.999Z', '11:59:59 pm IST');
  assert.ok(new Date('2026-08-09T00:30:00+05:30') > due, '12:30 am IST next day is late');
  assert.ok(new Date('2026-08-08T23:30:00+05:30') <= due, '11:30 pm IST on the day is on time');
  assert.equal(localDay(due), '2026-08-08', 'shown back as the same calendar day');
});

test('the offset is configurable', () => {
  const saved = process.env.APP_TIMEZONE_OFFSET;
  process.env.APP_TIMEZONE_OFFSET = '+00:00';
  try { assert.equal(endOfDay('2026-08-08').toISOString(), '2026-08-08T23:59:59.999Z'); }
  finally { if (saved === undefined) delete process.env.APP_TIMEZONE_OFFSET; else process.env.APP_TIMEZONE_OFFSET = saved; }
});
