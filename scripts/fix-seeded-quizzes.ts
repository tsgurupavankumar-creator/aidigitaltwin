/**
 * Replaces the old seeded placeholder quiz questions (choices A-D, answer
 * always "A", no wording) with real questions from src/lib/twin/question-bank.ts,
 * in place, without re-seeding (which would erase data).
 *
 *   npm run quizzes:fix-seeded            # dry run: lists what would change
 *   npm run quizzes:fix-seeded -- --apply # rewrites the questions
 *
 * Attempts that real students already made on those questions were graded
 * against "A"; they are counted and reported, not changed.
 */
import { PrismaClient } from '@prisma/client';
import { bankQuestion, isPlaceholderQuestion } from '../src/lib/twin/question-bank';

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  try {
    const quizzes = await prisma.quiz.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, courseId: true, questions: { orderBy: { createdAt: 'asc' }, select: { id: true, options: true, correctAnswer: true, concept: { select: { name: true } } } } },
    });
    const indexInCourse = new Map<string, number>();
    let toFix = 0, noBank = 0;
    const plan: Array<{ id: string; prompt: string; choices: string[]; answer: string }> = [];
    for (const quiz of quizzes) {
      const n = indexInCourse.get(quiz.courseId) ?? 0;
      indexInCourse.set(quiz.courseId, n + 1);
      for (const q of quiz.questions) {
        if (!isPlaceholderQuestion(q.options, q.correctAnswer)) continue;
        const bank = bankQuestion(q.concept.name, n);
        if (!bank) { noBank += 1; continue; }
        toFix += 1;
        plan.push({ id: q.id, prompt: bank.prompt, choices: bank.choices, answer: bank.answer });
      }
    }
    const affected = plan.length ? await prisma.quizResponse.count({ where: { questionId: { in: plan.map((p) => p.id) } } }) : 0;
    console.log(`${toFix} placeholder question(s) to replace${noBank ? `, ${noBank} with no bank question for their concept (left as is)` : ''}.`);
    if (affected) console.log(`${affected} recorded answer(s) on them were graded against the old answer "A"; they are left unchanged.`);
    if (!apply || !plan.length) { if (plan.length) console.log('Dry run. Re-run with --apply to change them.'); return; }
    for (const p of plan) {
      await prisma.question.update({ where: { id: p.id }, data: { options: { prompt: p.prompt, choices: p.choices }, correctAnswer: p.answer } });
    }
    console.log(`Replaced ${plan.length} question(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
