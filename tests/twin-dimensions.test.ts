import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTwinDimensions, type DimensionInputs } from '../src/lib/twin/dimensions';

const none: DimensionInputs = { attendance: [], pastDueAssignments: 0, handedInPastDue: 0, handedIn: 0, handedInLate: 0, quizzesAvailable: 0, quizzesAttempted: 0, mastery: [] };

test('no data behind a dimension: null (the twin keeps its previous value), never an invented number', () => {
  assert.deepEqual(computeTwinDimensions(none), { engagementScore: null, behaviorScore: null, skillsScore: null, learningVelocity: null });
});

test('engagement: weighted attendance, hand-in rate and quiz participation; missing parts re-weighted; excused ignored', () => {
  const full = computeTwinDimensions({ ...none, attendance: ['PRESENT', 'ABSENT', 'EXCUSED', 'LATE'], pastDueAssignments: 4, handedInPastDue: 2, quizzesAvailable: 5, quizzesAttempted: 5 });
  // attendance 2/3, hand-in 0.5, quizzes 1.0 -> (0.4*0.667 + 0.4*0.5 + 0.2*1) / 1.0
  assert.equal(full.engagementScore, 66.7);
  const attendanceOnly = computeTwinDimensions({ ...none, attendance: ['PRESENT', 'ABSENT'] });
  assert.equal(attendanceOnly.engagementScore, 50);
});

test('behaviour: late and missed work lower it; either part alone still counts', () => {
  assert.equal(computeTwinDimensions({ ...none, pastDueAssignments: 4, handedInPastDue: 4, handedIn: 4, handedInLate: 0 }).behaviorScore, 100);
  assert.equal(computeTwinDimensions({ ...none, pastDueAssignments: 4, handedInPastDue: 2, handedIn: 2, handedInLate: 1 }).behaviorScore, 50);
  assert.equal(computeTwinDimensions({ ...none, handedIn: 4, handedInLate: 1 }).behaviorScore, 75);
});

test('skills: share of assessed concepts at >= 70% mastery; unassessed concepts ignored', () => {
  const d = computeTwinDimensions({ ...none, mastery: [
    { masteryScore: 85, previousScore: null, assessmentCount: 1 }, { masteryScore: 70, previousScore: null, assessmentCount: 2 },
    { masteryScore: 40, previousScore: null, assessmentCount: 1 }, { masteryScore: 99, previousScore: null, assessmentCount: 0 },
  ] });
  assert.equal(d.skillsScore, 66.7);
  assert.equal(d.learningVelocity, null, 'no previous scores: trend unknown');
});

test('learning velocity: 0.5 steady, rises with gains, clamped to 0..1', () => {
  const v = (deltas: number[]) => computeTwinDimensions({ ...none, mastery: deltas.map((x) => ({ masteryScore: 60 + x, previousScore: 60, assessmentCount: 2 })) }).learningVelocity;
  assert.equal(v([0, 0]), 0.5);
  assert.equal(v([10, 10]), 0.75);
  assert.equal(v([-10]), 0.25);
  assert.equal(v([40]), 1);
  assert.equal(v([-40]), 0);
});
