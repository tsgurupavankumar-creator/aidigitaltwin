import Link from 'next/link';
import { ArrowLeft, Home, Loader, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { PaperTexture } from '@/components/ui/PaperTexture';

type Tone = 'default' | 'warning' | 'danger' | 'neutral';

interface StatusScreenProps {
  eyebrow?: string;
  title: string;
  description: string;
  tone?: Tone;
  icon?: ReactNode;
  primaryActionLabel?: string;
  primaryActionHref?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  onSecondaryAction?: () => void;
}

const toneStyles: Record<Tone, { badge: string; panel: string; glow: string; icon: string }> = {
  default: {
    badge: 'border-terracotta/30 bg-terracotta/5 text-terracotta',
    panel: 'border-paper-3 bg-paper-1/80',
    glow: 'from-terracotta/20 via-transparent to-transparent',
    icon: 'text-terracotta',
  },
  warning: {
    badge: 'border-mustard/40 bg-mustard/10 text-mustard',
    panel: 'border-paper-3 bg-paper-1/80',
    glow: 'from-mustard/20 via-transparent to-transparent',
    icon: 'text-mustard',
  },
  danger: {
    badge: 'border-burgundy/40 bg-burgundy/10 text-burgundy',
    panel: 'border-paper-3 bg-paper-1/80',
    glow: 'from-burgundy/20 via-transparent to-transparent',
    icon: 'text-burgundy',
  },
  neutral: {
    badge: 'border-plum/30 bg-plum/5 text-plum',
    panel: 'border-paper-3 bg-paper-1/80',
    glow: 'from-plum/20 via-transparent to-transparent',
    icon: 'text-plum',
  },
};

export function StatusScreen({
  eyebrow = 'Notice',
  title,
  description,
  tone = 'default',
  icon,
  primaryActionLabel,
  primaryActionHref,
  onPrimaryAction,
  secondaryActionLabel,
  secondaryActionHref,
  onSecondaryAction,
}: StatusScreenProps) {
  const style = toneStyles[tone];

  const PrimaryAction =
    primaryActionLabel && (onPrimaryAction || primaryActionHref)
      ? onPrimaryAction
        ? ({ children }: { children: ReactNode }) => (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-terracotta bg-terracotta px-4 py-2.5 text-sm font-medium text-paper-0 transition hover:bg-[#b24f2f]"
            >
              {children}
            </button>
          )
        : ({ children }: { children: ReactNode }) => (
            <Link
              href={primaryActionHref || '/'}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-terracotta bg-terracotta px-4 py-2.5 text-sm font-medium text-paper-0 transition hover:bg-[#b24f2f]"
            >
              {children}
            </Link>
          )
      : null;

  const SecondaryAction =
    secondaryActionLabel && (onSecondaryAction || secondaryActionHref)
      ? onSecondaryAction
        ? ({ children }: { children: ReactNode }) => (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-paper-3 bg-paper-0 px-4 py-2.5 text-sm font-medium text-ink-1 transition hover:border-ink-3"
            >
              {children}
            </button>
          )
        : ({ children }: { children: ReactNode }) => (
            <Link
              href={secondaryActionHref || '/'}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-paper-3 bg-paper-0 px-4 py-2.5 text-sm font-medium text-ink-1 transition hover:border-ink-3"
            >
              {children}
            </Link>
          )
      : null;

  const Icon = icon ?? <Loader className={cn('h-8 w-8 animate-spin', style.icon)} />;

  return (
    <PaperTexture className="flex min-h-screen items-center justify-center bg-paper-0 px-4 py-10 text-ink-0 sm:px-6">
      <div className="relative w-full max-w-xl overflow-hidden rounded-[24px] border border-paper-3 bg-paper-1/80 p-6 shadow-[0_18px_45px_rgba(26,24,20,0.06)] backdrop-blur-sm sm:p-8">
        <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', style.glow)} />

        <div className="relative z-10">
          <div className={cn('mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em]', style.badge)}>
            {eyebrow}
          </div>

          <div className={cn('mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-paper-3 bg-paper-0 shadow-sm', style.icon)}>
            {Icon}
          </div>

          <h1 className="font-fraunces text-3xl leading-none text-ink-0 sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-ink-2">{description}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {PrimaryAction && (
              <PrimaryAction>
                {primaryActionLabel === 'Retry' ? <RefreshCw className="h-4 w-4" /> : primaryActionLabel === 'Go home' ? <Home className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                {primaryActionLabel}
              </PrimaryAction>
            )}

            {SecondaryAction && (
              <SecondaryAction>
                {secondaryActionLabel === 'Back to safety' ? <Home className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                {secondaryActionLabel}
              </SecondaryAction>
            )}
          </div>
        </div>
      </div>
    </PaperTexture>
  );
}
