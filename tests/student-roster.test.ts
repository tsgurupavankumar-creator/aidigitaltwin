import test from 'node:test';
import assert from 'node:assert/strict';
import { isRosterEntryMatch, loadStudentRoster, parseStudentRoster } from '../src/lib/auth/student-roster';

test('roster parsing normalizes roll numbers and validates DOB values', () => {
  const roster = parseStudentRoster(JSON.stringify([
    { rollNumber: ' 24bce1234 ', dob: '2005-01-02' },
  ]));

  assert.deepEqual(roster, [{ rollNumber: '24BCE1234', dob: '2005-01-02' }]);
  assert.throws(() => parseStudentRoster('[{"rollNumber":"R1","dob":"2005-02-30"}]'));
});

test('roster rejects duplicate roll numbers after normalization', () => {
  assert.throws(
    () => parseStudentRoster('[{"rollNumber":"r1","dob":"2005-01-01"},{"rollNumber":"R1","dob":"2005-01-02"}]'),
    /Duplicate roll number/
  );
});

test('eligibility requires both the normalized roll number and exact DOB', () => {
  const roster = parseStudentRoster('[{"rollNumber":"R1","dob":"2005-01-01"}]');

  assert.equal(isRosterEntryMatch(roster, ' r1 ', '2005-01-01'), true);
  assert.equal(isRosterEntryMatch(roster, 'R1', '2005-01-02'), false);
  assert.equal(isRosterEntryMatch(roster, 'R2', '2005-01-01'), false);
});

test('loading roster fails explicitly when it is missing, empty, or malformed', () => {
  assert.throws(() => loadStudentRoster({}), /not configured/);
  assert.throws(() => loadStudentRoster({ STUDENT_ROSTER_JSON: '[]' }), /no enrollment records/);
  assert.throws(() => loadStudentRoster({ STUDENT_ROSTER_JSON: 'not-json' }));
});
