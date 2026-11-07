import { z } from 'zod';

const idString = z.string().min(10, 'Invalid ID').max(64, 'Invalid ID').regex(/^[a-z0-9-]+$/i, 'Invalid ID');
const orderIndex = z.number().int().min(0, 'Order must be zero or greater');

export const SyllabusUploadRequestSchema = z.object({
  originalFileName: z.string().trim().min(1, 'File name is required').max(255, 'File name must be 255 characters or fewer'),
  mimeType: z.literal('application/pdf', { error: 'Only PDF files are supported' }),
  fileSizeBytes: z.number().int().positive('File size must be a positive whole number').max(10 * 1024 * 1024, 'PDF must be 10 MB or smaller'),
}).strict();

const syllabusTopicSchema = z.object({
  name: z.string().trim().min(1, 'Topic name is required').max(200, 'Topic name must be 200 characters or fewer'),
  description: z.string().max(2000, 'Topic description must be 2,000 characters or fewer').optional(),
  orderIndex,
  depth: z.number().int().min(0).max(3).optional(),
  parentTopicIndex: z.number().int().min(0).nullable().optional(),
  prerequisiteIndexes: z.array(z.number().int().min(0)).max(10).optional(),
  levelTarget: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  parseConfidence: z.number().min(0).max(1).optional(),
  estimatedMinutes: z.number().int().min(1).max(600).optional(),
}).strict();

const syllabusModuleSchema = z.object({
  name: z.string().trim().min(1, 'Module name is required').max(200, 'Module name must be 200 characters or fewer'),
  description: z.string().max(2000, 'Module description must be 2,000 characters or fewer').optional(),
  orderIndex,
  estimatedMinutes: z.number().int().min(5).max(2400).optional(),
  parseConfidence: z.number().min(0).max(1).optional(),
  topics: z.array(syllabusTopicSchema).min(1, 'Each module must have at least one topic').max(100, 'A module may have at most 100 topics'),
}).strict();

export const SyllabusParseResultSchema = z.object({
  overallConfidence: z.number().min(0).max(1).optional(),
  warnings: z.array(z.string()).max(10).optional(),
  modules: z.array(syllabusModuleSchema).min(1, 'At least one module is required').max(50, 'A syllabus may have at most 50 modules'),
}).strict();

export const SyllabusTopicSelectionSchema = z.object({
  selectedTopicIds: z.array(idString).min(1, 'Select at least one topic').max(200, 'Select at most 200 topics'),
  courseId: idString,
  syllabusId: idString,
}).strict();
