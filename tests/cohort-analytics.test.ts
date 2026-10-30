import test from 'node:test';
import assert from 'node:assert/strict';
import { cohortAnalytics } from '../src/lib/twin/cohort-analytics';

const now = new Date('2026-10-28T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

test('analytics: real averages, at-risk share, intervention completion and weekly trend', () => {
  const a = cohortAnalytics({
    now,
    students: [
      { id: 's1', academicHealth: 80, riskLevel: 'LOW' },
      { id: 's2', academicHealth: 60, riskLevel: 'HIGH' },
      { id: 's3', academicHealth: 70, riskLevel: null },
    ],
    interventions: [{ completedAt: daysAgo(1) }, { completedAt: null }],
    snapshots: [
      { studentId: 's1', createdAt: daysAgo(9), academicHealth: 70 },
      { studentId: 's2', createdAt: daysAgo(8), academicHealth: 50 },
      { studentId: 's1', createdAt: daysAgo(1), academicHealth: 80 },
      { studentId: 's2', createdAt: daysAgo(1), academicHealth: 60 },
    ],
  });
  assert.equal(a.avgHealth, 70);
  assert.equal(a.assessedStudents, 2);
  assert.equal(a.atRisk, 1);
  assert.equal(a.notAtRiskRate, 50);
  assert.deepEqual([a.interventions, a.interventionsCompleted, a.completionRate], [2, 1, 50]);
  const last = a.trend[a.trend.length - 1], prev = a.trend[a.trend.length - 2];
  assert.deepEqual([prev.avgHealth, last.avgHealth], [60, 70], 'week-end averages of each student\'s latest snapshot');
  assert.equal(a.healthChangeVsLastWeek, 10, 'latest weekly point vs the one before (same calculation on both sides)');
});

test('analytics with no data: every number is null, never an invented default', () => {
  const a = cohortAnalytics({ now, students: [], interventions: [], snapshots: [] });
  assert.equal(a.avgHealth, null);
  assert.equal(a.notAtRiskRate, null);
  assert.equal(a.completionRate, null);
  assert.ok(a.trend.every((t) => t.avgHealth === null));
});
