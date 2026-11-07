import { Check } from 'lucide-react';
import type { WizardStep } from './types';

const steps: Array<{ id: WizardStep; label: string }> = [
  { id: 'course', label: 'Choose Course' },
  { id: 'upload', label: 'Upload Syllabus' },
  { id: 'topics', label: 'Select Topics' },
  { id: 'settings', label: 'Configure Quiz' },
  { id: 'review', label: 'Review & Generate' },
];

export function WizardStepper({
  currentStep,
  completedSteps,
}: {
  currentStep: WizardStep;
  completedSteps: WizardStep[];
}) {
  const activeIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <ol aria-label="Quiz creation progress" className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {steps.map((step, index) => {
        const complete = completedSteps.includes(step.id);
        const active = step.id === currentStep;
        return (
          <li
            key={step.id}
            aria-current={active ? 'step' : undefined}
            className={`flex items-center gap-2 border-b-2 pb-3 text-xs ${
              active
                ? 'border-plum font-semibold text-ink-0'
                : complete
                  ? 'border-olive text-ink-1'
                  : 'border-paper-3 text-ink-3'
            }`}
          >
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-current font-mono">
              {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span>{step.label}</span>
          </li>
        );
      })}
      <li className="sr-only">Step {Math.max(activeIndex + 1, 1)} of {steps.length}</li>
    </ol>
  );
}
