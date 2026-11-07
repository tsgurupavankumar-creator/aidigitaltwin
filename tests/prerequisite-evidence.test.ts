import assert from 'node:assert/strict';
import test from 'node:test';
import { extractExplicitPrerequisites } from '../src/lib/practice/prerequisite-evidence';
const topics = [
  { id: 'bfs', name: '1.1 Breadth-First Search', prerequisiteIds: [] },
  { id: 'astar', name: '1.3.1 A Star Search', prerequisiteIds: [] },
  { id: 'dfs', name: '1.2 Depth-First Search', prerequisiteIds: [] },
];
test('extracts a source-backed natural-language prerequisite', () => {
  const source = 'Knowledge of Breadth-First Search is required before A Star Search.';
  const found = extractExplicitPrerequisites(source, topics);
  assert.equal(found.length, 1);
  assert.equal(found[0].targetTopicId, 'astar');
  assert.equal(found[0].requiredTopicId, 'bfs');
  assert.ok(found[0].explanation.includes(source));
});
test('recognizes reverse order and avoids mere ordering or hierarchy', () => {
  assert.equal(extractExplicitPrerequisites('A Star Search requires Breadth-First Search.', topics).length, 1);
  assert.equal(extractExplicitPrerequisites('1.1 Breadth-First Search\n1.3.1 A Star Search', topics).length, 0);
});
test('skips unrecognized and already-confirmed dependencies', () => {
  const linked = topics.map(t => t.id === 'astar' ? { ...t, prerequisiteIds: ['bfs'] } : t);
  assert.equal(extractExplicitPrerequisites('A Star Search requires Breadth-First Search.', linked).length, 0);
  assert.equal(extractExplicitPrerequisites('Graph traversal is helpful for search.', topics).length, 0);
  assert.equal(extractExplicitPrerequisites('A Star Search does not require Breadth-First Search.', topics).length, 0);
});
