'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { AuthCard } from './AuthCard';
import { PasswordStrengthIndicator, checkPasswordStrength, isPasswordValid } from './PasswordStrengthIndicator';

const ROLL_NUMBER_REGEX = /^[0-9]{2}[A-Z]{3}[0-9]{4}$/;

export function StudentSignupForm() {
  const router = useRouter();
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    fullName: '',
    rollNumber: '',
    email: '',
    dateOfBirth: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const passwordRules = useMemo(() => checkPasswordStrength(form.password), [form.password]);
  const isConfirmMatch = form.confirmPassword && form.password === form.confirmPassword;

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const validateField = (key: keyof typeof form, value: string) => {
    const nextErrors = { ...errors };

    switch (key) {
      case 'fullName':
        if (!value.trim()) nextErrors.fullName = 'Full name is required.';
        break;
      case 'rollNumber':
        if (!value.trim()) nextErrors.rollNumber = 'Roll number is required.';
        else if (!ROLL_NUMBER_REGEX.test(value.trim())) nextErrors.rollNumber = 'Roll number must be in format 24BCE1234 (2 digits + 3 uppercase letters + 4 digits)';
        break;
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) nextErrors.email = 'Please enter a valid email address.';
        break;
      case 'dateOfBirth':
        if (!value) nextErrors.dateOfBirth = 'Date of birth is required.';
        break;
      case 'password':
        if (!value) nextErrors.password = 'Password is required.';
        else if (!isPasswordValid(value)) nextErrors.password = 'Password must include 8+ characters, uppercase, lowercase, a number, and a special character.';
        break;
      case 'confirmPassword':
        if (!value) nextErrors.confirmPassword = 'Please confirm your password.';
        else if (value !== form.password) nextErrors.confirmPassword = 'Passwords do not match.';
        break;
      default:
        break;
    }

    setErrors(nextErrors);
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.fullName.trim()) nextErrors.fullName = 'Full name is required.';
    if (!form.rollNumber.trim()) nextErrors.rollNumber = 'Roll number is required.';
    else if (!ROLL_NUMBER_REGEX.test(form.rollNumber.trim())) nextErrors.rollNumber = 'Roll number must be in format 24BCE1234 (2 digits + 3 uppercase letters + 4 digits)';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = 'Please enter a valid email address.';
    if (!form.dateOfBirth) nextErrors.dateOfBirth = 'Date of birth is required.';
    if (!form.password) nextErrors.password = 'Password is required.';
    else if (!isPasswordValid(form.password)) nextErrors.password = 'Password must include 8+ characters, uppercase, lowercase, a number, and a special character.';
    if (!form.confirmPassword) nextErrors.confirmPassword = 'Please confirm your password.';
    else if (form.confirmPassword !== form.password) nextErrors.confirmPassword = 'Passwords do not match.';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/signup/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          rollNumber: form.rollNumber.trim().toUpperCase(),
          email: form.email.trim(),
          dob: form.dateOfBirth,
          password: form.password,
          confirmPassword: form.confirmPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setErrors((current) => ({ ...current, form: data.error || 'Unable to create account.' }));
        setIsSubmitting(false);
        return;
      }

      router.push(data.redirectTo || '/student');
      router.refresh();
    } catch {
      setErrors((current) => ({ ...current, form: 'Unable to create account right now.' }));
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
      <AuthCard
        title="Create account"
        subtitle="Set up your student profile"
        accent="terracotta"
        footer={
          <p>
            Already have an account?{' '}
            <Link href="/login/student" className="font-medium text-ink-0 underline-offset-4 transition-all hover:underline">
              Sign in →
            </Link>
          </p>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          {errors.form ? (
            <div className="flex items-start gap-2 rounded-md border border-burgundy/20 bg-burgundy/5 px-3 py-2 text-sm text-burgundy">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errors.form}</span>
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor="student-name" className="block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">Full Name</label>
            <input id="student-name" ref={firstInputRef} value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} onBlur={() => validateField('fullName', form.fullName)} className="w-full border-0 border-b border-paper-3 bg-transparent py-2.5 text-[16px] text-ink-0 outline-none transition-colors placeholder:text-ink-3 focus:border-terracotta" placeholder="Jane Doe" aria-invalid={Boolean(errors.fullName)} />
            {errors.fullName ? <p className="text-xs text-burgundy">{errors.fullName}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="student-roll-number" className="block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">Roll Number</label>
            <input id="student-roll-number" value={form.rollNumber} onChange={(event) => updateField('rollNumber', event.target.value.toUpperCase())} onBlur={() => validateField('rollNumber', form.rollNumber)} className="w-full border-0 border-b border-paper-3 bg-transparent py-2.5 font-mono text-[16px] text-ink-0 outline-none transition-colors placeholder:text-ink-3 focus:border-terracotta" placeholder="24BCE1234" maxLength={9} aria-invalid={Boolean(errors.rollNumber)} />
            {errors.rollNumber ? <p className="text-xs text-burgundy">{errors.rollNumber}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="student-email" className="block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">Email</label>
            <input id="student-email" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} onBlur={() => validateField('email', form.email)} className="w-full border-0 border-b border-paper-3 bg-transparent py-2.5 text-[16px] text-ink-0 outline-none transition-colors placeholder:text-ink-3 focus:border-terracotta" placeholder="student@example.com" aria-invalid={Boolean(errors.email)} />
            {errors.email ? <p className="text-xs text-burgundy">{errors.email}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="student-dob" className="block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">Date of Birth</label>
            <input id="student-dob" type="date" value={form.dateOfBirth} onChange={(event) => updateField('dateOfBirth', event.target.value)} onBlur={() => validateField('dateOfBirth', form.dateOfBirth)} className="w-full border-0 border-b border-paper-3 bg-transparent py-2.5 text-[16px] text-ink-0 outline-none transition-colors focus:border-terracotta" aria-invalid={Boolean(errors.dateOfBirth)} />
            {errors.dateOfBirth ? <p className="text-xs text-burgundy">{errors.dateOfBirth}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="student-password" className="block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">Password</label>
            <div className="relative">
              <input id="student-password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => updateField('password', event.target.value)} onBlur={() => validateField('password', form.password)} className="w-full border-0 border-b border-paper-3 bg-transparent py-2.5 pr-10 text-[16px] text-ink-0 outline-none transition-colors placeholder:text-ink-3 focus:border-terracotta" placeholder="Create a strong password" aria-invalid={Boolean(errors.password)} />
              <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-ink-3 hover:text-ink-0" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password ? <p className="text-xs text-burgundy">{errors.password}</p> : null}
            <PasswordStrengthIndicator password={form.password} />
          </div>

          <div className="space-y-2">
            <label htmlFor="student-confirm-password" className="block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">Confirm Password</label>
            <div className="relative">
              <input id="student-confirm-password" type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={(event) => updateField('confirmPassword', event.target.value)} onBlur={() => validateField('confirmPassword', form.confirmPassword)} className="w-full border-0 border-b border-paper-3 bg-transparent py-2.5 pr-10 text-[16px] text-ink-0 outline-none transition-colors placeholder:text-ink-3 focus:border-terracotta" placeholder="Re-enter password" aria-invalid={Boolean(errors.confirmPassword)} />
              <button type="button" onClick={() => setShowConfirmPassword((current) => !current)} className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-ink-3 hover:text-ink-0" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {form.confirmPassword ? (
              <div className="flex items-center gap-2 text-xs text-ink-2">
                {isConfirmMatch ? <CheckCircle2 className="h-4 w-4 text-olive" /> : <AlertCircle className="h-4 w-4 text-burgundy" />}
                <span className={isConfirmMatch ? 'text-olive' : 'text-burgundy'}>{isConfirmMatch ? 'Passwords match' : 'Passwords do not match'}</span>
              </div>
            ) : null}
            {errors.confirmPassword ? <p className="text-xs text-burgundy">{errors.confirmPassword}</p> : null}
          </div>

          <button type="submit" disabled={isSubmitting} className="mt-2 flex w-full items-center justify-center rounded-[8px] bg-terracotta px-4 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-paper-0 transition-all duration-150 hover:bg-[#B4512D] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70">
            {isSubmitting ? 'Creating account...' : 'Create Student Account'}
          </button>
        </form>
      </AuthCard>
    </motion.div>
  );
}