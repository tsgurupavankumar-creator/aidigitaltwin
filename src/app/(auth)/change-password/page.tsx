'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [forced, setForced] = useState(false);
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(async (r) => {
      if (r.status === 401) { router.replace('/login'); return; }
      const body = await r.json();
      setForced(!!body.user?.mustChangePassword);
    });
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.next !== form.confirm) { setError('The new passwords do not match.'); return; }
    setBusy(true);
    const res = await fetch('/api/auth/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
    });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.error ?? 'Could not change the password.'); return; }
    setDone(true);
    setTimeout(() => router.replace(body.redirectTo ?? '/'), 1500);
  }

  const field = (id: keyof typeof form, label: string, autoComplete: string) => (
    <div>
      <label htmlFor={`cp-${id}`} className="block font-mono text-[10px] uppercase tracking-widest text-ink-3 mb-1">{label}</label>
      <input id={`cp-${id}`} type="password" autoComplete={autoComplete} required value={form[id]}
        onChange={(e) => setForm({ ...form, [id]: e.target.value })}
        className="w-full px-3 py-2 text-sm bg-paper-0 border border-paper-3 rounded text-ink-0 outline-none focus:border-plum" />
    </div>
  );

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-paper-1">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 bg-paper-0 border border-paper-3 rounded-lg p-6">
        <h1 className="text-2xl font-libre italic text-ink-0">{forced ? 'Set your own password' : 'Change password'}</h1>
        {forced && <p className="text-xs text-ink-2">Your account was created with a temporary password. Choose your own to continue.</p>}
        {field('current', forced ? 'Temporary password' : 'Current password', 'current-password')}
        {field('next', 'New password', 'new-password')}
        {field('confirm', 'Confirm new password', 'new-password')}
        <p className="text-[11px] text-ink-3">At least 8 characters, with upper- and lower-case letters, a number and a special character. Other devices will be signed out.</p>
        {error && <p role="alert" className="text-xs text-burgundy">{error}</p>}
        {done && <p role="status" className="text-xs text-sage">Password changed.</p>}
        <button type="submit" disabled={busy || done} className="w-full py-2 rounded bg-plum text-paper-0 text-sm font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Save new password'}</button>
      </form>
    </main>
  );
}
