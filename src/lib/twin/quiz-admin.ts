import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { cuid } from './http';
import { questionOptions } from './quiz';
import { RecordError } from './records';
import { localDateTime } from './deadline';

/** Shared quiz validation for creating and editing quizzes. */
export const question = z.object({
  prompt: z.string().trim().min(1).max(2000),
  type: z.enum(['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER']),
  choices: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
  correctAnswer: z.string().trim().min(1).max(500),
  conceptId: cuid,
  difficulty: z.number().int().min(1).max(5).default(3),
});

export const quizSettings = {
  maxAttempts: z.number().int().min(1).max(50).nullable().optional(),
  opensAt: z.string().max(25).nullable().optional(),
  closesAt: z.string().max(25).nullable().optional(),
};

/** Checks questions against the course and returns the rows to store. */
export async function prepareQuestions(courseId: string, questions: z.infer<typeof question>[]) {
  questions.forEach((q, i) => {
    if (q.type === 'MCQ' && q.choices.length < 2) throw new RecordError(`Question ${i + 1}: a multiple-choice question needs at least 2 choices.`);
    const choices = questionOptions(q).choices;
    if (choices.length && !choices.some((c) => c.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase())) {
      throw new RecordError(`Question ${i + 1}: the correct answer must be one of the choices.`);
    }
  });
  const conceptIds = [...new Set(questions.map((q) => q.conceptId))];
  const found = await prisma.concept.count({ where: { courseId, id: { in: conceptIds } } });
  if (found !== conceptIds.length) throw new RecordError('Some concepts do not belong to this course.');
  return questions.map((q) => ({
    conceptId: q.conceptId, type: q.type, difficulty: q.difficulty,
    options: questionOptions(q), correctAnswer: q.type === 'TRUE_FALSE' ? (q.correctAnswer.toLowerCase().startsWith('t') ? 'True' : 'False') : q.correctAnswer,
  }));
}

/** Validates open/close times (local time in the institution's time zone). */
export function settingsFrom(input: { maxAttempts?: number | null; opensAt?: string | null; closesAt?: string | null }) {
  let opensAt: Date | null, closesAt: Date | null;
  try { opensAt = localDateTime(input.opensAt); closesAt = localDateTime(input.closesAt); }
  catch { throw new RecordError('Open and close times must be valid dates and times.'); }
  if (opensAt && closesAt && closesAt <= opensAt) throw new RecordError('The quiz must close after it opens.');
  return { maxAttempts: input.maxAttempts ?? null, opensAt, closesAt };
}

