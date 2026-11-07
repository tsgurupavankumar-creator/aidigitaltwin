/**
 * Approve faculty sign-ups (they start as PENDING and cannot log in until approved).
 *   npm run faculty:approve              lists pending accounts
 *   npm run faculty:approve -- FAC003    approves FAC003
 * Needs DATABASE_URL (the database the app uses).
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const id = process.argv[2];
    if (!id) {
      const pending = await prisma.faculty.findMany({ where: { user: { status: 'PENDING' } }, select: { facultyId: true, fullName: true, department: true, user: { select: { email: true, createdAt: true } } } });
      if (!pending.length) { console.log('No faculty accounts are waiting for approval.'); return; }
      console.log('Waiting for approval:');
      for (const f of pending) console.log(`  ${f.facultyId}  ${f.fullName}  (${f.department}, ${f.user.email}, signed up ${f.user.createdAt.toISOString().slice(0, 10)})`);
      console.log('\nApprove one with: npm run faculty:approve -- <FACULTY ID>');
      return;
    }
    const f = await prisma.faculty.findUnique({ where: { facultyId: id }, select: { fullName: true, user: { select: { id: true, status: true } } } });
    if (!f) throw new Error(`No faculty account with ID ${id}.`);
    if (f.user.status === 'ACTIVE') { console.log(`${id} (${f.fullName}) is already active.`); return; }
    await prisma.user.update({ where: { id: f.user.id }, data: { status: 'ACTIVE' } });
    await prisma.auditLog.create({ data: { userId: f.user.id, event: 'FACULTY_APPROVED', metadata: { facultyId: id } } });
    console.log(`Approved ${id} (${f.fullName}). They can log in now.`);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
