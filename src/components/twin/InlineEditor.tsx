'use client';

import { useState } from 'react';
import { Pencil, Save, Trash2, X } from 'lucide-react';
import { inputClass, labelClass } from './ui';

export interface EditorField { name: string; label: string; type?: 'text' | 'number' | 'date'; value: string }

/**
 * Small "Edit / Delete" control used across faculty pages. Calls onSave with the edited values
 * (strings; numbers are converted by the caller) and onDelete after a confirmation.
 */
export function InlineEditor({ id, fields, onSave, onDelete, deleteConfirm, compact = true }: {
  id: string;
  fields: EditorField[];
  onSave: (values: Record<string, string>) => Promise<string | null>;
  onDelete?: () => Promise<string | null>;
  deleteConfirm?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const start = () => { setValues(Object.fromEntries(fields.map((f) => [f.name, f.value]))); setError(''); setOpen(true); };
  const save = async () => {
    setBusy(true); setError('');
    const err = await onSave(values);
    setBusy(false);
    if (err) setError(err); else setOpen(false);
  };
  const remove = async () => {
    if (!onDelete || !confirm(deleteConfirm ?? 'Delete this?')) return;
    setBusy(true); setError('');
    const err = await onDelete();
    setBusy(false);
    if (err) setError(err);
  };

  if (!open) {
    return (
      <span className="inline-flex items-center gap-2">
        <button type="button" onClick={start} aria-label="Edit" className="p-1 text-ink-3 hover:text-plum"><Pencil className="w-3.5 h-3.5" /></button>
        {onDelete && <button type="button" onClick={remove} aria-label="Delete" disabled={busy} className="p-1 text-ink-3 hover:text-burgundy"><Trash2 className="w-3.5 h-3.5" /></button>}
        {error && <span role="alert" className="text-[11px] text-burgundy">{error}</span>}
      </span>
    );
  }
  return (
    <div className={`space-y-2 p-3 rounded border border-paper-3 bg-paper-0 ${compact ? 'text-xs' : ''}`}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {fields.map((f) => (
          <div key={f.name}>
            <label htmlFor={`${id}-${f.name}`} className={labelClass}>{f.label}</label>
            <input id={`${id}-${f.name}`} type={f.type ?? 'text'} className={inputClass} value={values[f.name] ?? ''} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
          </div>
        ))}
      </div>
      {error && <p role="alert" className="text-[11px] text-burgundy">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-plum text-paper-0 text-xs font-semibold disabled:opacity-50"><Save className="w-3.5 h-3.5" />Save</button>
        <button type="button" onClick={() => setOpen(false)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-paper-3 text-xs"><X className="w-3.5 h-3.5" />Cancel</button>
      </div>
    </div>
  );
}

/** Helper: send a JSON request and return an error message or null. */
export async function send(url: string, method: 'PATCH' | 'DELETE', body?: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (res.ok) return null;
  return (await res.json().catch(() => ({}))).error ?? 'Something went wrong.';
}
