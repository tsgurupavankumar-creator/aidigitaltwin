import type { ReactNode } from 'react';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';

/**
 * One layout for every number card: label on top, the value on its own line, a caption below.
 * Numbers animate; a null value shows "—" with an honest caption instead of a made-up number.
 */
export function StatCard({ label, value, suffix = '', decimals = 0, display, caption, tone = 'text-ink-0', children }: {
  label: string;
  value?: number | null;
  suffix?: string;
  decimals?: number;
  /** Pre-formatted value (e.g. a range); used instead of `value` when given. */
  display?: string;
  caption?: ReactNode;
  tone?: string;
  children?: ReactNode;
}) {
  const missing = display === undefined && (value === null || value === undefined || !Number.isFinite(value));
  return (
    <div className="p-6 rounded-md bg-paper-0 border border-paper-3 flex flex-col gap-2 min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-3">{label}</p>
      <div className={`font-space font-bold text-3xl leading-none ${missing ? 'text-ink-3' : tone}`}>
        {display !== undefined ? display
          : missing ? '—'
          : decimals > 0 ? `${(value as number).toFixed(decimals)}${suffix}`
          : <AnimatedCounter value={Math.round(value as number)} suffix={suffix} />}
      </div>
      {caption !== undefined && <div className="text-xs text-ink-2">{missing && display === undefined ? 'Not enough data yet' : caption}</div>}
      {children}
    </div>
  );
}
