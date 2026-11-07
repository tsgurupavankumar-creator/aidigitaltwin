/**
 * Replaces the published seed passwords (Student@123 / Faculty@123) on an
 * EXISTING database without re-running the seed (which erases data).
 *
 *   npm run passwords:rotate-defaults            # dry run: lists affected accounts
 *   npm run passwords:rotate-defaults -- --apply # changes them
 *
 * With --apply, every affected account gets its own random strong password,
 * its sessions are deleted (forcing a fresh login), and the new passwords are
 * written to rotated-credentials.local.csv (git-ignored). Hand them out
 * privately, then delete the file.
 */
import { writeFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { planRotation, toCsv } from './lib/password-rotation';

const OUTPUT = 'rotated-credentials.local.csv';

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, passwordHash: true } });
    const plan = await planRotation(users, (plain, hash) => bcrypt.compare(plain, hash));
    console.log(`${plan.length} of ${users.length} accounts still use a published default password.`);
    for (const p of plan) console.log(`  ${p.role.padEnd(8)} ${p.email}`);
    if (!plan.length) return;
    if (!apply) {
      console.log('\nDry run only. Re-run with --apply to change them.');
      return;
    }
    for (const p of plan) {
      const passwordHash = await bcrypt.hash(p.newPassword, 10);
      await prisma.$transaction([
        prisma.user.update({ where: { id: p.id }, data: { passwordHash } }),
        prisma.session.deleteMany({ where: { userId: p.id } }),
      ]);
    }
    writeFileSync(OUTPUT, toCsv(plan), { mode: 0o600 });
    console.log(`\nChanged ${plan.length} passwords and ended their sessions. New passwords: ${OUTPUT}`);
    console.log('Share them privately, then delete that file.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
