import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeQuestionHash, questionDedupKey } from '../src/lib/practice/deduplication';
test('dedup hash is invariant to option order and casing', () => assert.equal(computeQuestionHash(' What IS AI? ', ['A','B']), computeQuestionHash('what is ai?', ['b','a'])));
test('different prompts hash differently', () => assert.notEqual(computeQuestionHash('What is AI?', ['a']), computeQuestionHash('Define ML?', ['a'])));
test('student/topic/tier scoping changes database dedup key', () => {
 const h=computeQuestionHash('What is AI?');
 assert.notEqual(questionDedupKey('s1','t1','BEGINNER',h),questionDedupKey('s2','t1','BEGINNER',h));
 assert.notEqual(questionDedupKey('s1','t1','BEGINNER',h),questionDedupKey('s1','t1','ADVANCED',h));
});
