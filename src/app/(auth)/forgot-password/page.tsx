'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Mail, Send, AlertCircle } from 'lucide-react';
import { PaperTexture } from '@/components/ui/PaperTexture';
import { HairlineRule } from '@/components/ui/HairlineRule';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Unable to reach the server right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="font-fraunces text-2xl text-ink-0">Password Recovery</h1>
          <p className="text-xs text-ink-2">
            Enter the email associated with your account to receive reset instructions.
          </p>
        </div>

        <HairlineRule />

        {submitted ? (
          <div className="p-4 rounded bg-olive-light border border-olive/30 space-y-3 text-center">
            <CheckCircle className="w-6 h-6 text-olive mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-ink-0">Instructions Sent</h3>
              <p className="text-xs text-ink-2">
                If an account exists matching <span className="font-semibold text-ink-0">{email}</span>, instructions have been dispatched.
              </p>
            </div>
            <Link href="/login" className="inline-block text-xs font-semibold text-olive hover:underline pt-2">
              Return to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-mono uppercase tracking-widest text-ink-3 font-medium block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@vit.ac.in"
                className="w-full py-2 text-sm font-dmsans bg-transparent border-b border-paper-3 text-ink-0 placeholder:text-ink-3 focus:border-b-2 focus:border-terracotta outline-none transition-all"
                required
                autoFocus
              />
            </div>

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
              {loading ? (
                <span>Sending...</span>
              ) : (
                <>
                  <span>Send Reset Instructions</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </PaperTexture>
  );
}

