import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});

const rosterSchema = z.array(z.object({
  rollNumber: z.string().trim().min(1).max(50).transform((value) => value.toUpperCase()),
  dob: isoDate,
}).strict());

export type StudentRosterEntry = z.infer<typeof rosterSchema>[number];

export function parseStudentRoster(value: string): StudentRosterEntry[] {
  const parsed: unknown = JSON.parse(value);
  const roster = rosterSchema.parse(parsed);
  const rolls = new Set<string>();
  for (const entry of roster) {
    if (rolls.has(entry.rollNumber)) throw new Error(`Duplicate roll number in student roster: ${entry.rollNumber}`);
    rolls.add(entry.rollNumber);
  }
  return roster;
}

export function loadStudentRoster(env: Partial<NodeJS.ProcessEnv> = process.env): StudentRosterEntry[] {
  const configuredRoster = env.STUDENT_ROSTER_JSON;
  if (!configuredRoster) throw new Error('STUDENT_ROSTER_JSON is not configured');
  const roster = parseStudentRoster(configuredRoster);
  if (!roster.length) throw new Error('STUDENT_ROSTER_JSON contains no enrollment records');
  return roster;
}

export function isRosterEntryMatch(
  roster: StudentRosterEntry[],
  rollNumber: string,
  dob: string
): boolean {
  const normalizedRoll = rollNumber.trim().toUpperCase();
  return roster.some((entry) => entry.rollNumber === normalizedRoll && entry.dob === dob);
}
