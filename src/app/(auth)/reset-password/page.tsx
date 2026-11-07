'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, AlertCircle, KeyRound } from 'lucide-react';
import { PaperTexture } from '@/components/ui/PaperTexture';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('This reset link is missing its token. Please request a new one.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'Unable to reset your password. Please try again.');
        setLoading(false);
        return;
      }

      setSubmitted(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch {
      setError('Unable to reach the server right now. Please try again.');
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <PaperTexture className="min-h-screen bg-paper-1 flex items-center justify-center p-6 text-ink-0 font-inter">
        <div className="max-w-md w-full bg-paper-0 border border-paper-3 rounded-md p-8 sm:p-10 shadow-sm space-y-6 text-center">
          <AlertCircle className="w-6 h-6 text-burgundy mx-auto" />
          <div className="space-y-1">
            <h1 className="font-fraunces text-2xl text-ink-0">Invalid Reset Link</h1>
            <p className="text-xs text-ink-2">
              This link is missing its reset token. Please request a new password reset.
            </p>
          </div>
          <Link href="/forgot-password" className="inline-block text-xs font-semibold text-olive hover:underline">
            Request a new link
          </Link>
        </div>
      </PaperTexture>
    );
  }

  return (
    <PaperTexture className="min-h-screen bg-paper-1 flex items-center justify-center p-6 text-ink-0 font-inter">
      <div className="max-w-md w-full bg-paper-0 border border-paper-3 rounded-md p-8 sm:p-10 shadow-sm space-y-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-ink-3 hover:text-ink-0 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Login
        </Link>

        <div className="space-y-1">
          <h1 className="font-fraunces text-2xl text-ink-0 flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Set a New Password
          </h1>
          <p className="text-xs text-ink-2">Choose a new password for your account.</p>
        </div>

        <HairlineRule />

        {submitted ? (
          <div className="p-4 rounded bg-olive-light border border-olive/30 space-y-3 text-center">
            <CheckCircle className="w-6 h-6 text-olive mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-ink-0">Password Updated</h3>
              <p className="text-xs text-ink-2">Redirecting you to login…</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordInput
              label="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a strong password"
              accentColor="terracotta"
              autoFocus
            />
            <PasswordStrengthIndicator password={password} />

            <PasswordInput
              label="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              accentColor="terracotta"
            />

            {error ? (
              <div className="flex items-start gap-2 rounded-md border border-burgundy/20 bg-burgundy/5 px-3 py-2 text-sm text-burgundy">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-sm text-xs font-semibold uppercase tracking-wider text-paper-0 bg-terracotta hover:bg-terracotta-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </PaperTexture>
  );
}
