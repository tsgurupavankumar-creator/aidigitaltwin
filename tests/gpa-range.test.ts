import test from 'node:test';
import assert from 'node:assert/strict';
import { formatGpaRange } from '../src/lib/format/gpa-range';

test('GPA forecast shows a 0.2 range and clamps to the 0-4 scale', () => {
  assert.equal(formatGpaRange(3.4), '3.20 - 3.60');
  assert.equal(formatGpaRange(0.1), '0.00 - 0.30');
  assert.equal(formatGpaRange(4), '3.80 - 4.00');
});
