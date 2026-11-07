'use client';

import { Button, inputClass, labelClass } from '@/components/twin/ui';
import type { QuizGenerationRequest } from './types';

const difficulties: QuizGenerationRequest['difficulty'][] = ['easy', 'medium', 'hard', 'mixed'];
const questionTypes: Array<{ value: QuizGenerationRequest['questionTypes'][number]; label: string }> = [
  { value: 'mcq', label: 'Multiple choice' },
  { value: 'true_false', label: 'True / false' },
  { value: 'short_answer', label: 'Short answer' },
];

export function QuizSettingsPanel({
  settings,
  onChange,
  selectedTopicCount,
}: {
  settings: QuizGenerationRequest;
  onChange: (settings: QuizGenerationRequest) => void;
  selectedTopicCount: number;
}) {
  const disabled = selectedTopicCount === 0;
  const update = (patch: Partial<QuizGenerationRequest>) => onChange({ ...settings, ...patch });

  return (
    <fieldset disabled={disabled} className="space-y-5 disabled:opacity-60">
      <legend className="sr-only">Quiz settings</legend>
      {disabled && <p className="text-xs text-ink-2">Select at least one topic</p>}
      <div className="flex flex-wrap gap-2" aria-label="Question count presets">{([['Quick 5', 5], ['Standard 10', 10], ['Deep 20', 20]] as const).map(([label, count]) => <Button key={label} variant="ghost" onClick={() => update({ questionCount: count })}>{label}</Button>)}</div>
      <div>
        <label htmlFor="question-count" className={labelClass}>Number of questions</label>
        <input
          id="question-count"
          type="number"
          min={1}
          max={30}
          value={settings.questionCount}
          onChange={(event) => {
            const value = Number(event.currentTarget.value);
            if (Number.isInteger(value) && value >= 1 && value <= 30) update({ questionCount: value });
          }}
          className={inputClass}
        />
      </div>
      <div>
        <span className={labelClass}>Difficulty</span>
        <div role="group" aria-label="Difficulty" className="flex flex-wrap gap-2">
          {difficulties.map((difficulty) => (
            <Button
              key={difficulty}
              variant={settings.difficulty === difficulty ? 'primary' : 'ghost'}
              onClick={() => update({ difficulty })}
            >
              {difficulty}
            </Button>
          ))}
        </div>
      </div>
      <div>
        <span className={labelClass}>Question types</span>
        <div className="space-y-2">
          {questionTypes.map(({ value, label }) => {
            const checked = settings.questionTypes.includes(value);
            return (
              <label key={value} className="flex items-center gap-2 text-sm text-ink-1">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? settings.questionTypes.filter((type) => type !== value)
                      : [...settings.questionTypes, value];
                    if (next.length > 0) update({ questionTypes: next });
                  }}
                  className="accent-plum"
                />
                {label}
              </label>
            );
          })}
        </div>
      </div>
      {/* TODO(Veda): presets (Quick 5 / Standard 10 / Deep 20) */}
    </fieldset>
  );
}
