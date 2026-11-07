import { z } from 'zod';

const idString = z.string().min(10, 'Invalid ID').max(64, 'Invalid ID').regex(/^[a-z0-9-]+$/i, 'Invalid ID');

export const StudyPlanStepSchema = z.object({
  title: z.string().trim().min(1, 'Step title is required').max(200, 'Step title must be 200 characters or fewer'),
  reason: z.string().trim().min(1, 'Step reason is required').max(500, 'Step reason must be 500 characters or fewer'),
  estimatedMinutes: z.number().int().min(5, 'Estimated time must be at least 5 minutes').max(240, 'Estimated time must be at most 240 minutes'),
  syllabusTopicId: idString,
  conceptId: idString.nullable(),
  orderIndex: z.number().int().min(0, 'Order must be zero or greater'),
}).strict();

export const StudyPlanOutputSchema = z.object({
  steps: z.array(StudyPlanStepSchema).min(3, 'A study plan needs at least 3 steps').max(5, 'A study plan may have at most 5 steps'),
  horizon: z.enum(['today', 'this_week', 'this_month']).default('this_week'),
}).strict();
