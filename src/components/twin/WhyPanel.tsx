'use client';

/**
 * Plain-language explanation of the latest assessment and model contributions.
 */
interface Reason { feature: string; value: number | null; effect: number }
export interface Explanation {
  summary?: string;
  riskReasons?: Reason[];
  learningReasons?: Reason[];
  predictedRange?: { low: number; high: number } | null;
  models?: { earlyWarning?: string | null; learning?: string | null; riskLevels?: string };
}

const LABELS: Record<string, string> = {
  currentAttendance: 'Attendance so far', recentAttendance: 'Recent attendance', attendanceCount: 'Lectures recorded',
  absenceRate: 'Absence rate', earlyAvgScore: 'Average mark so far', earlyAssessedCount: 'Pieces of work marked',
  earlyMissedCount: 'Assignments missed', earlyLateCount: 'Assignments handed in late',
  avgMastery: 'Average mark so far', avgQuizScore: 'Quiz average', avgSubmissionScore: 'Assignment average',
  quizCount: 'Quizzes taken', submissionCount: 'Assignments graded', quizTrend: 'Quiz trend', lastScore: 'Latest mark',
  scoreTrend: 'Mark trend', scoreStd: 'Spread of marks', lateCount: 'Late assignments', missedCount: 'Missed assignments',
};
const PERCENT = new Set(['currentAttendance', 'recentAttendance', 'earlyAvgScore', 'avgMastery', 'avgQuizScore', 'avgSubmissionScore', 'lastScore']);
const SIGNED = new Set(['quizTrend', 'scoreTrend']);

export function describeValue(feature: string, value: number | null): string {
  if (value === null) return 'not known yet';
  if (feature === 'absenceRate') return `${Math.round(value * 100)}%`;
  if (PERCENT.has(feature)) return `${Math.round(value)}%`;
  if (SIGNED.has(feature)) return `${value > 0 ? '+' : ''}${Math.round(value)} points`;
  if (feature === 'scoreStd') return `±${Math.round(value)} points`;
  return String(Math.round(value));
}

export const labelFor = (feature: string) => LABELS[feature] ?? feature;

export function WhyPanel({ explanation, configSource }: { explanation?: Explanation; configSource?: string }) {
  const risk = explanation?.riskReasons ?? [];
  const learn = explanation?.learningReasons ?? [];
  const range = explanation?.predictedRange;
  if (!risk.length && !learn.length && !range && !explanation?.summary) return null;

  const strengths = learn.filter((reason) => reason.effect > 0).slice(0, 2);
  const opportunities = learn.filter((reason) => reason.effect < 0).slice(0, 2);

  return (
    <details className="group rounded border border-paper-3 bg-paper-1 text-xs text-ink-1">
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-plum">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-plum">Why? The reasons behind the latest review</span>
        <span aria-hidden className="text-plum transition-transform group-open:rotate-90">▸</span>
      </summary>
      <div className="space-y-3 border-t border-paper-3 p-4">
        <p className="text-ink-1">
          {strengths.length
            ? `Your recent ${strengths.map((reason) => labelFor(reason.feature).toLowerCase()).join(' and ')} are supporting your progress.`
            : 'Your latest review considers your learning and attendance signals together to identify helpful next steps.'}
          {opportunities.length
            ? ` A focused review of ${opportunities.map((reason) => labelFor(reason.feature).toLowerCase()).join(' and ')} may help strengthen your next assessment.`
            : ' Keep building on your current progress with steady practice.'}
        </p>
        {explanation?.summary && <p className="text-ink-2">{explanation.summary}</p>}
        {risk.length > 0 && (
          <div>
            <p className="mb-1 font-semibold text-ink-0">Signals considered in your review</p>
            <ul className="list-disc space-y-0.5 pl-5">
              {risk.map((reason) => <li key={reason.feature}>{labelFor(reason.feature)}: <b>{describeValue(reason.feature, reason.value)}</b></li>)}
            </ul>
          </div>
        )}
        {range && (
          <p><span className="font-semibold text-ink-0">Predicted next mark:</span> likely between <b>{Math.round(range.low)}%</b> and <b>{Math.round(range.high)}%</b> <span className="text-ink-3">(the true mark fell in this range about 80% of the time on held-out data)</span></p>
        )}
        {learn.length > 0 && (
          <div>
            <p className="mb-1 font-semibold text-ink-0">What moved the predicted mark</p>
            <ul className="list-disc space-y-0.5 pl-5">
              {learn.map((reason) => <li key={reason.feature}>{labelFor(reason.feature)}: <b>{describeValue(reason.feature, reason.value)}</b> <span className="text-ink-3">({reason.effect >= 0 ? 'supports' : 'may lower'} the prediction)</span></li>)}
            </ul>
          </div>
        )}
        {explanation?.models && (explanation.models.earlyWarning || explanation.models.learning) && (
          <p className="font-mono text-[10px] text-ink-3">Models: early warning {explanation.models.earlyWarning ?? '—'} · marks {explanation.models.learning ?? '—'}</p>
        )}
        {configSource && (
          <p className="font-mono text-[10px] text-ink-3">Risk levels: {configSource === 'data' ? 'calibrated on held-out OULAD data' : 'hand-set defaults (run ml/calibrate_risk_score.py to calibrate)'}</p>
        )}
      </div>
    </details>
  );
}
