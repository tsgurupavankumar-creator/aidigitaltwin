import test from 'node:test';
import assert from 'node:assert/strict';
import { formatGpa, formatGpaRange } from '../src/lib/format/gpa-range';

test('10-point grade: the range comes from the real 80% mark range; no data shows a dash, never a made-up number', () => {
  assert.equal(formatGpaRange(8.1, { low: 72, high: 88 }), '7.2 – 8.8');
  assert.equal(formatGpaRange(9.6, { low: 90, high: 104 }), '9.0 – 10.0', 'clamped to the scale');
  assert.equal(formatGpaRange(7.4), '≈ 7.4', 'no range known: one value, clearly approximate');
  assert.equal(formatGpaRange(null), '—');
  assert.equal(formatGpa(undefined), '—');
  assert.equal(formatGpa(8.25), '8.3');
});
