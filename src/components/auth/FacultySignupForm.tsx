'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { AuthCard } from './AuthCard';
import { PasswordStrengthIndicator, checkPasswordStrength, isPasswordValid } from './PasswordStrengthIndicator';

const FACULTY_ID_REGEX = /^FAC[0-9]{3}$/;

export function FacultySignupForm() {
  const router = useRouter();
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    fullName: '',
    facultyId: '',
    department: 'CSE',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

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
      case 'facultyId':
        if (!value.trim()) nextErrors.facultyId = 'Faculty ID is required.';
        else if (!FACULTY_ID_REGEX.test(value.trim())) nextErrors.facultyId = 'Faculty ID must be in format FAC001 (FAC + 3 digits)';
        break;
      case 'department':
        if (!value.trim()) nextErrors.department = 'Department is required.';
        break;
      case 'email':
        if (!value.trim()) nextErrors.email = 'Email is required for faculty.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) nextErrors.email = 'Please enter a valid email address.';
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
    if (!form.facultyId.trim()) nextErrors.facultyId = 'Faculty ID is required.';
    else if (!FACULTY_ID_REGEX.test(form.facultyId.trim())) nextErrors.facultyId = 'Faculty ID must be in format FAC001 (FAC + 3 digits)';
    if (!form.department.trim()) nextErrors.department = 'Department is required.';
    if (!form.email.trim()) nextErrors.email = 'Email is required for faculty.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = 'Please enter a valid email address.';
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
      const response = await fetch('/api/auth/signup/faculty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          facultyId: form.facultyId.trim().toUpperCase(),
          department: form.department,
          email: form.email.trim(),
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

      setSuccessMessage('Account created! Awaiting admin approval. Redirecting to login...');
      setTimeout(() => {
        router.push('/login/faculty');
      }, 2000);
    } catch {
      setErrors((current) => ({ ...current, form: 'Unable to create account right now.' }));
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
      <AuthCard
        title="Faculty Portal"
        subtitle="Create your faculty account"
        accent="plum"
        footer={
          <p>
            Already registered?{' '}
            <Link href="/login/faculty" className="font-medium text-ink-0 underline-offset-4 transition-all hover:underline">
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

          {successMessage ? (
            <div className="flex items-start gap-2 rounded-md border border-olive/20 bg-olive/5 px-3 py-2 text-sm text-olive">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor="faculty-name" className="block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">Full Name</label>
            <input id="faculty-name" ref={firstInputRef} value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} onBlur={() => validateField('fullName', form.fullName)} className="w-full border-0 border-b border-paper-3 bg-transparent py-2.5 text-[16px] text-ink-0 outline-none transition-colors placeholder:text-ink-3 focus:border-plum" placeholder="Dr. Jane Smith" aria-invalid={Boolean(errors.fullName)} />
            {errors.fullName ? <p className="text-xs text-burgundy">{errors.fullName}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="faculty-id" className="block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">Faculty ID</label>
            <input id="faculty-id" value={form.facultyId} onChange={(event) => updateField('facultyId', event.target.value.toUpperCase())} onBlur={() => validateField('facultyId', form.facultyId)} className="w-full border-0 border-b border-paper-3 bg-transparent py-2.5 font-mono text-[16px] text-ink-0 outline-none transition-colors placeholder:text-ink-3 focus:border-plum" placeholder="FAC001" maxLength={6} aria-invalid={Boolean(errors.facultyId)} />
            {errors.facultyId ? <p className="text-xs text-burgundy">{errors.facultyId}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="faculty-department" className="block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">Department</label>
            <select id="faculty-department" value={form.department} onChange={(event) => updateField('department', event.target.value)} onBlur={() => validateField('department', form.department)} className="w-full border-0 border-b border-paper-3 bg-transparent py-2.5 text-[16px] text-ink-0 outline-none transition-colors focus:border-plum" aria-invalid={Boolean(errors.department)}>
              <option value="CSE">CSE</option>
              <option value="ECE">ECE</option>
              <option value="MECH">MECH</option>
              <option value="CIVIL">CIVIL</option>
              <option value="IT">IT</option>
              <option value="AI">AI</option>
            </select>
            {errors.department ? <p className="text-xs text-burgundy">{errors.department}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="faculty-email" className="block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">Email</label>
            <input id="faculty-email" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} onBlur={() => validateField('email', form.email)} className="w-full border-0 border-b border-paper-3 bg-transparent py-2.5 text-[16px] text-ink-0 outline-none transition-colors placeholder:text-ink-3 focus:border-plum" placeholder="faculty@university.edu" aria-invalid={Boolean(errors.email)} />
            {errors.email ? <p className="text-xs text-burgundy">{errors.email}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="faculty-password" className="block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">Password</label>
            <div className="relative">
              <input id="faculty-password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => updateField('password', event.target.value)} onBlur={() => validateField('password', form.password)} className="w-full border-0 border-b border-paper-3 bg-transparent py-2.5 pr-10 text-[16px] text-ink-0 outline-none transition-colors placeholder:text-ink-3 focus:border-plum" placeholder="Create a strong password" aria-invalid={Boolean(errors.password)} />
              <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-ink-3 hover:text-ink-0" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password ? <p className="text-xs text-burgundy">{errors.password}</p> : null}
            <PasswordStrengthIndicator password={form.password} />
          </div>

          <div className="space-y-2">
            <label htmlFor="faculty-confirm-password" className="block text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">Confirm Password</label>
            <div className="relative">
              <input id="faculty-confirm-password" type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={(event) => updateField('confirmPassword', event.target.value)} onBlur={() => validateField('confirmPassword', form.confirmPassword)} className="w-full border-0 border-b border-paper-3 bg-transparent py-2.5 pr-10 text-[16px] text-ink-0 outline-none transition-colors placeholder:text-ink-3 focus:border-plum" placeholder="Re-enter password" aria-invalid={Boolean(errors.confirmPassword)} />
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

          <div className="rounded-md border border-paper-3 bg-paper-1 px-3 py-2 text-xs text-ink-2">
            Faculty accounts require administrator approval before activation.
          </div>

          <button type="submit" disabled={isSubmitting} className="mt-2 flex w-full items-center justify-center rounded-[8px] bg-plum px-4 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-paper-0 transition-all duration-150 hover:bg-[#56414c] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70">
            {isSubmitting ? 'Creating account...' : 'Register as Faculty'}
          </button>
        </form>
      </AuthCard>
    </motion.div>
  );
}