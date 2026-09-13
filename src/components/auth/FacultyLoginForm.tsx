'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { AuthCard } from './AuthCard';
import { PasswordInput } from './PasswordInput';
import { useAuthStore } from '@/store/authStore';

const FACULTY_ID_REGEX = /^FAC[0-9]{3}$/;

export function FacultyLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refreshSession = useAuthStore((s) => s.refreshSession);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const [facultyId, setFacultyId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    firstInputRef.current?.focus();

    const errorType = searchParams.get('error');
    if (errorType === 'session_required') {
      setError('Please sign in to continue.');
    } else if (errorType === 'invalid_session') {
      setError('Your session has expired. Please sign in again.');
    } else if (errorType === 'wrong_role') {
      setError('This account does not have access to the faculty portal.');
    }
  }, [searchParams]);

  const validate = () => {
    if (!facultyId.trim()) {
      setError('Please enter your faculty ID.');
      return false;
    }
    if (!FACULTY_ID_REGEX.test(facultyId.trim())) {
      setError('Faculty ID must be in format FAC001 (FAC + 3 digits)');
      return false;
    }
    if (!password) {
      setError('Please enter your password.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login/faculty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facultyId: facultyId.trim().toUpperCase(), password, rememberMe }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'Authentication failed. Please try again.');
        setIsSubmitting(false);
        return;
      }

      await refreshSession();
      router.replace(data.redirectTo || '/faculty');
      router.refresh();
    } catch {
      setError('Unable to sign in right now. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
      <AuthCard
        title="Faculty Portal"
        subtitle="Sign in to your faculty account"
        accent="plum"
        footer={
          <p>
            Are you a student?{' '}
            <Link href="/login/student" className="font-medium text-ink-0 underline-offset-4 transition-all hover:underline">
              Return to student login →
            </Link>
          </p>
        }
      >
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <label htmlFor="faculty-id" className="block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">
              Faculty ID
            </label>
            <input
              id="faculty-id"
              ref={firstInputRef}
              type="text"
              value={facultyId}
              onChange={(event) => setFacultyId(event.target.value.toUpperCase())}
              placeholder="FAC001"
              maxLength={6}
              autoComplete="username"
              aria-invalid={Boolean(error)}
              aria-describedby="faculty-login-error"
              className="w-full border-0 border-b border-paper-3 bg-transparent py-2.5 font-mono text-[16px] text-ink-0 outline-none transition-colors placeholder:text-ink-3 focus:border-plum"
            />
          </div>

          <PasswordInput
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            accentColor="plum"
          />

          <div className="flex items-center justify-between gap-2 text-sm text-ink-2">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="h-4 w-4 rounded border-paper-3 text-plum focus:ring-0" />
              <span>Remember me</span>
            </label>
            <Link href="/forgot-password" className="relative text-ink-2 transition-colors hover:text-ink-0 after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-ink-0 after:transition-transform after:duration-200 hover:after:scale-x-100">
              Forgot password?
            </Link>
          </div>

          {error ? (
            <div id="faculty-login-error" className="flex items-start gap-2 rounded-md border border-burgundy/20 bg-burgundy/5 px-3 py-2 text-sm text-burgundy">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-plum px-4 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-paper-0 transition-all duration-150 hover:bg-[#56414c] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
            {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        </form>

        <div className="mt-6 flex items-center gap-4 text-sm text-ink-3">
          <div className="h-px flex-1 bg-paper-3" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em]">New here?</span>
          <div className="h-px flex-1 bg-paper-3" />
        </div>

        <Link href="/signup/faculty" className="mt-5 inline-flex w-full items-center justify-center rounded-[8px] border border-paper-3 bg-paper-1 px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-ink-0 transition-all duration-150 hover:border-plum hover:bg-paper-0 active:scale-[0.98]">
          Register as Faculty
        </Link>
      </AuthCard>
    </motion.div>
  );
}
