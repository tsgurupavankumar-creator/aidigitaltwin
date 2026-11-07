import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTION_BANK, bankQuestion, isPlaceholderQuestion } from '../src/lib/twin/question-bank';

const SEEDED_QUIZ_CONCEPTS = ['Normalization', 'Transactions', 'SQL', 'Indexing', 'ER Model', 'Deadlocks', 'Memory Management', 'Scheduling', 'File Systems', 'Process Sync'];

test('every concept used by the seeded quizzes has a real question for each of the 3 quizzes', () => {
  for (const name of SEEDED_QUIZ_CONCEPTS) {
    assert.ok((QUESTION_BANK[name]?.length ?? 0) >= 3, name);
    for (let i = 0; i < 3; i++) {
      const q = bankQuestion(name, i)!;
      assert.ok(q.prompt.length > 10, `${name} ${i} has wording`);
      assert.ok(q.choices.includes(q.answer), `${name} ${i}: answer is one of the choices`);
      assert.equal(new Set(q.choices).size, q.choices.length, `${name} ${i}: choices are distinct`);
    }
  }
});

test('as served, the correct answer appears in every position, not always first (no "always A")', () => {
  const positions = new Map<number, number>();
  for (const name of Object.keys(QUESTION_BANK)) for (let i = 0; i < 3; i++) {
    const q = bankQuestion(name, i)!;
    const p = q.choices.indexOf(q.answer);
    positions.set(p, (positions.get(p) ?? 0) + 1);
  }
  assert.equal(positions.size, 4, `answer positions used: ${[...positions.keys()]}`);
  assert.ok(Math.max(...positions.values()) <= 15, 'no position dominates');
});

test('placeholder detection matches only the old seeded pattern', () => {
  assert.equal(isPlaceholderQuestion(['A', 'B', 'C', 'D'], 'A'), true);
  assert.equal(isPlaceholderQuestion({ prompt: 'x', choices: ['A', 'B'] }, 'A'), false);
  assert.equal(isPlaceholderQuestion(['A', 'B', 'C', 'D'], 'B'), false);
});
