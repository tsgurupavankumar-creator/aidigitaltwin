import { readFileSync } from 'node:fs';
import { parseStudentRoster } from '../src/lib/auth/student-roster';

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: npx tsx scripts/prepare-student-roster.ts <roll-number-dob.csv>');
  process.exitCode = 1;
} else {
  try {
    const lines = readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    const header = lines.shift()?.split(',').map((value) => value.trim().toLowerCase());
    if (!header || header.length !== 2 || header[0] !== 'rollnumber' || header[1] !== 'dob') {
      throw new Error('CSV header must be exactly: rollNumber,dob');
    }

    const rows = lines.filter(Boolean).map((line, index) => {
      const columns = line.split(',').map((value) => value.trim());
      if (columns.length !== 2) throw new Error(`Invalid CSV row ${index + 2}: expected rollNumber,dob`);
      return { rollNumber: columns[0], dob: columns[1] };
    });
    const roster = parseStudentRoster(JSON.stringify(rows));
    console.log(JSON.stringify(roster));
    console.error(`Validated ${roster.length} student roster entries. Set the output as STUDENT_ROSTER_JSON in the server environment.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Unable to parse student roster');
    process.exitCode = 1;
  }
}
