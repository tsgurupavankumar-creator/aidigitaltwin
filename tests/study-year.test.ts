import test from 'node:test';
import assert from 'node:assert/strict';
import { studyYearFromRoll } from '../src/lib/auth/study-year';

test('year and semester come from the roll number and the date, not a fixed "year 2, semester 4"', () => {
  assert.deepEqual(studyYearFromRoll('24BCE2032', new Date('2026-10-29')), { year: 3, semester: 5 }, 'Oct 2026: third year, odd semester');
  assert.deepEqual(studyYearFromRoll('24BCE2032', new Date('2027-02-10')), { year: 3, semester: 6 }, 'Feb 2027: same year, even semester');
  assert.deepEqual(studyYearFromRoll('26BCE0001', new Date('2026-08-01')), { year: 1, semester: 1 }, 'first-years');
  assert.equal(studyYearFromRoll('BCE123', new Date('2026-08-01')), null, 'no admission year');
  assert.equal(studyYearFromRoll('99BCE0001', new Date('2026-08-01')), null, 'implausible');
});
