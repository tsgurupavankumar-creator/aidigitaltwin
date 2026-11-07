/**
 * Question wording lives in Question.options, because the schema has no text
 * column. New questions store { prompt, choices }; older seeded questions
 * store a bare array of choices and have no wording, so they are shown with
 * a generic prompt naming their concept.
 */
export type QuestionKind = 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER';

export function questionOptions(q: { type: QuestionKind; prompt: string; choices: string[] }) {
  const choices = q.type === 'TRUE_FALSE' ? ['True', 'False'] : q.type === 'MCQ' ? q.choices : [];
  return { prompt: q.prompt, choices };
}

export function displayQuestion(options: unknown, type: QuestionKind, conceptName: string, index: number) {
  if (options && typeof options === 'object' && !Array.isArray(options)) {
    const o = options as { prompt?: unknown; choices?: unknown };
    return {
      prompt: typeof o.prompt === 'string' && o.prompt ? o.prompt : `Question ${index + 1} (${conceptName})`,
      choices: Array.isArray(o.choices) ? o.choices.filter((c): c is string => typeof c === 'string') : type === 'TRUE_FALSE' ? ['True', 'False'] : [],
    };
  }
  const choices = Array.isArray(options) ? options.filter((c): c is string => typeof c === 'string') : type === 'TRUE_FALSE' ? ['True', 'False'] : [];
  return { prompt: `Question ${index + 1} (${conceptName})`, choices };
}
