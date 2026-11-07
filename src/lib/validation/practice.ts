import { z } from 'zod';

export const TopicLevelSchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
export type TopicLevelValue = z.infer<typeof TopicLevelSchema>;
export const PracticeSessionRequestSchema = z.object({
  syllabusTopicId: z.string().min(10).max(64),
  targetDifficulty: TopicLevelSchema,
  questionCount: z.number().int().min(3).max(20).default(5),
  mode: z.literal('practice').default('practice'),
  overridePrerequisite: z.boolean().default(false),
}).strict();
export const PracticeSubmitSchema = z.object({
  quizId: z.string().min(10).max(64),
  answers: z.record(z.string(), z.string().max(2000)),
  startToken: z.string().max(200),
  timeSpentSec: z.number().int().min(0).max(7200).default(0),
}).strict();
export const SyllabusEditSchema = z.object({
  modules: z.array(z.object({ id: z.string(), name: z.string().min(1).max(200).optional(), estimatedMinutes: z.number().int().min(5).max(2400).optional() }).strict()).max(50).optional(),
  topics: z.array(z.object({ id: z.string(), name: z.string().min(1).max(200).optional(), description: z.string().max(2000).optional(), estimatedMinutes: z.number().int().min(1).max(600).optional(), levelTarget: TopicLevelSchema.optional() }).strict()).max(100).optional(),
}).strict();
