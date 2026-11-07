import type { z } from 'zod';
import { QuizGenerationRequestSchema } from '@/lib/validation/quiz-generation';
import { SyllabusParseResultSchema } from '@/lib/validation/syllabus';

export type SyllabusParseResult = z.infer<typeof SyllabusParseResultSchema>;
export type QuizGenerationRequest = z.infer<typeof QuizGenerationRequestSchema>;

export type WizardStep = 'course' | 'upload' | 'topics' | 'settings' | 'review';

export interface WizardState {
  step: WizardStep;
  courseId: string | null;
  courseName: string | null;
  syllabusId: string | null;
  syllabus: SyllabusParseResult | null;
  selectedTopicIds: string[];
  quizSettings: QuizGenerationRequest;
  error: string | null;
  isUploading: boolean;
  isGenerating: boolean;
}
