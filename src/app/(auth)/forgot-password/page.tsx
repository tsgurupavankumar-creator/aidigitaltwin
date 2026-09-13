'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Mail, Send } from 'lucide-react';
import { PaperTexture } from '@/components/ui/PaperTexture';
import { HairlineRule } from '@/components/ui/HairlineRule';

export default function ForgotPasswordPage() {
  const [emailOrId, setEmailOrId] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrId.trim()) return;

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1200);
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
            Enter your Roll Number, Faculty ID, or Email to receive instructions.
          </p>
        </div>

        <HairlineRule />

        {submitted ? (
          <div className="p-4 rounded bg-olive-light border border-olive/30 space-y-3 text-center">
            <CheckCircle className="w-6 h-6 text-olive mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-ink-0">Instructions Sent</h3>
              <p className="text-xs text-ink-2">
                If an account exists matching <span className="font-semibold text-ink-0">{emailOrId}</span>, instructions have been dispatched.
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
                IDENTIFIER / EMAIL
              </label>
              <input
                type="text"
                value={emailOrId}
                onChange={(e) => setEmailOrId(e.target.value)}
                placeholder="24BCE0480 or FAC001 or email@vit.ac.in"
                className="w-full py-2 text-sm font-dmsans bg-transparent border-b border-paper-3 text-ink-0 placeholder:text-ink-3 focus:border-b-2 focus:border-terracotta outline-none transition-all"
                required
                autoFocus
              />
            </div>

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
