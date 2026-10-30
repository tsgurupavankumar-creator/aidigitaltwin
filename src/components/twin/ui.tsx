'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

export function Panel({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-4">
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3">
          {title && <h2 className="font-baskerville italic text-xl text-ink-0">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-ink-3 hover:text-ink-0 transition-colors">
      <ArrowLeft className="w-3.5 h-3.5" />
      {label}
    </Link>
  );
}

export function Button({ children, onClick, disabled, variant = 'primary', type = 'button' }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'ghost'; type?: 'button' | 'submit';
}) {
  const base = 'px-3 py-2 text-xs font-mono rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5';
  const style = variant === 'primary' ? 'bg-plum text-paper-0 hover:bg-plum/90' : 'bg-paper-1 border border-paper-3 text-ink-1 hover:bg-paper-2';
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${style}`}>{children}</button>;
}

export const inputClass = 'w-full px-3 py-2 text-xs font-dmsans bg-paper-0 border border-paper-3 rounded text-ink-0 placeholder:text-ink-3 outline-none focus:border-plum';
export const labelClass = 'block font-mono text-[10px] uppercase tracking-widest text-ink-3 mb-1';

export function Loading({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="p-10 flex items-center justify-center gap-2 text-ink-2">
      <Loader2 className="w-5 h-5 animate-spin text-plum" />
      <span className="font-mono text-xs uppercase tracking-wider">{label}</span>
    </div>
  );
}

export interface Notice { kind: 'ok' | 'error'; text: string; details?: string[] }

export function NoticeBox({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  const ok = notice.kind === 'ok';
  return (
    <div className={`p-3 rounded border text-xs space-y-1 ${ok ? 'bg-olive/10 border-olive/30 text-ink-0' : 'bg-burgundy/10 border-burgundy/20 text-burgundy'}`}>
      <p className="flex items-center gap-1.5 font-semibold">
        {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-olive" /> : <AlertTriangle className="w-3.5 h-3.5" />}
        {notice.text}
      </p>
      {notice.details && notice.details.length > 0 && (
        <ul className="list-disc pl-5 font-mono text-[11px] space-y-0.5 max-h-48 overflow-auto">
          {notice.details.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      )}
    </div>
  );
}

/** "Saved 12. Digital twins updating for 12 students." */
export function savedNotice(body: { saved?: number; unchanged?: number; twinUpdatesQueued?: number }, what = 'record'): Notice {
  const parts = [`Saved ${body.saved ?? 0} ${what}${body.saved === 1 ? '' : 's'}`];
  if (body.unchanged) parts.push(`${body.unchanged} unchanged`);
  const queued = body.twinUpdatesQueued ?? 0;
  return {
    kind: 'ok',
    text: `${parts.join(', ')}.${queued ? ` Digital twins updating for ${queued} student${queued === 1 ? '' : 's'} (agents run in the background; refresh in a few seconds).` : ''}`,
  };
}

/** Turns an error response into a notice, including per-row CSV errors. */
export async function errorNotice(res: Response): Promise<Notice> {
  const body = await res.json().catch(() => ({}));
  const rows: Array<{ row: number; message: string }> | undefined = body?.details?.errors;
  return {
    kind: 'error',
    text: body?.error || `Request failed (HTTP ${res.status})`,
    details: rows?.map((r) => (r.row ? `Row ${r.row}: ${r.message}` : r.message)),
  };
}

export function RefreshButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <Button variant="ghost" onClick={onClick} disabled={busy}>
      <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
      Refresh
    </Button>
  );
}
