import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleDay, taskFor } from '../src/lib/twin/study-plan';
import { computeTwinDimensions } from '../src/lib/twin/dimensions';

test('task size follows how weak the concept is (no fixed 30 minutes)', () => {
  assert.deepEqual(taskFor(30), { priority: 'HIGH', estimatedMins: 80 });
  assert.deepEqual(taskFor(60), { priority: 'MEDIUM', estimatedMins: 35 });
  assert.deepEqual(taskFor(68), { priority: 'LOW', estimatedMins: 23 });
  assert.deepEqual(taskFor(0), { priority: 'HIGH', estimatedMins: 90 }, 'capped');
  assert.equal(taskFor(null).priority, 'MEDIUM', 'not assessed yet');
});

test('tasks are spread over the next 7 days, least busy day first', () => {
  const now = new Date('2026-10-29T10:00:00Z');
  const day = (d: number) => new Date(Date.UTC(2026, 9, 29 + d));
  assert.equal(scheduleDay([], now).toISOString().slice(0, 10), '2026-10-30', 'tomorrow when empty');
  const busy = [{ scheduledFor: day(1), estimatedMins: 60, completed: false }, { scheduledFor: day(2), estimatedMins: 30, completed: false }];
  assert.equal(scheduleDay(busy, now).toISOString().slice(0, 10), '2026-11-01', 'first free day');
  const done = [{ scheduledFor: day(1), estimatedMins: 60, completed: true }];
  assert.equal(scheduleDay(done, now).toISOString().slice(0, 10), '2026-10-30', 'completed tasks do not count');
});

test('completed study tasks raise engagement; tasks not yet due do not count', () => {
  const base = { attendance: ['PRESENT', 'ABSENT'], pastDueAssignments: 0, handedInPastDue: 0, handedIn: 0, handedInLate: 0, quizzesAvailable: 0, quizzesAttempted: 0, mastery: [] };
  const none = computeTwinDimensions({ ...base, studyTasksDue: 2, studyTasksDone: 0 }).engagementScore!;
  const all = computeTwinDimensions({ ...base, studyTasksDue: 2, studyTasksDone: 2 }).engagementScore!;
  assert.ok(all > none);
  assert.equal(computeTwinDimensions({ ...base, studyTasksDue: 0 }).engagementScore, 50, 'no due tasks: attendance only');
});
