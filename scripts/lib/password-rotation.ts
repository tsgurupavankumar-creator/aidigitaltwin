import { randomInt } from 'node:crypto';
import { validatePasswordStrength } from '../../src/lib/auth/password';

export const PUBLISHED_DEFAULT_PASSWORDS = ['Student@123', 'Faculty@123'] as const;

const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGIT = '23456789';
const SYMBOL = '!@#$%^*-_+=?';
const ALL = LOWER + UPPER + DIGIT + SYMBOL;

/** A random password that always satisfies the app's strength rules. */
export function generatePassword(length = 16): string {
  const pick = (set: string) => set[randomInt(set.length)];
  const chars = [pick(LOWER), pick(UPPER), pick(DIGIT), pick(SYMBOL)];
  while (chars.length < length) chars.push(pick(ALL));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  const password = chars.join('');
  if (!validatePasswordStrength(password).valid) throw new Error('generator produced a weak password');
  return password;
}

export interface RotationUser { id: string; email: string; role: string; passwordHash: string }
export interface RotationPlanItem { id: string; email: string; role: string; newPassword: string }

/** Users whose current hash matches a published default, each with a fresh password. */
export async function planRotation(
  users: RotationUser[],
  compare: (plain: string, hash: string) => Promise<boolean>,
  makePassword: () => string = generatePassword
): Promise<RotationPlanItem[]> {
  const plan: RotationPlanItem[] = [];
  for (const user of users) {
    let usesDefault = false;
    for (const candidate of PUBLISHED_DEFAULT_PASSWORDS) {
      if (await compare(candidate, user.passwordHash)) { usesDefault = true; break; }
    }
    if (usesDefault) plan.push({ id: user.id, email: user.email, role: user.role, newPassword: makePassword() });
  }
  return plan;
}

export function toCsv(plan: RotationPlanItem[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return ['email,role,new_password', ...plan.map((p) => [p.email, p.role, p.newPassword].map(esc).join(','))].join('\n') + '\n';
}
