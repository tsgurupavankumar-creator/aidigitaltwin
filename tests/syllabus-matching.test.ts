import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closestCourseConcept, conceptSimilarity } from '../src/app/api/student/syllabus/concept-matching';

test('course-scoped fuzzy matching reuses close concept names', () => {
  const concepts = [{id:'existing12345',name:'Data Structures and Algorithms'}];
  assert.equal(closestCourseConcept('Data structures & algorithms', concepts)?.id, 'existing12345');
  assert.equal(closestCourseConcept('Database Transactions', concepts), null);
  assert.equal(conceptSimilarity('  LINEAR  ALGEBRA ', 'linear algebra'), 1);
});
