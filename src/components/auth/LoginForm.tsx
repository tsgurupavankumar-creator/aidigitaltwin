'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, RefreshCw, AlertCircle, ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NormalizedRole } from '@/lib/auth/roles';
import { RoleTabs } from './RoleTabs';
import { PasswordInput } from './PasswordInput';
import { useAuthStore } from '@/store/authStore';
import { DEMO_CREDENTIALS } from '@/data/users';
import { HairlineRule } from '../ui/HairlineRule';

interface LoginFormProps {
  initialRole?: NormalizedRole;
}

export function LoginForm({ initialRole = 'student' }: LoginFormProps) {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [role, setRole] = useState<NormalizedRole>(initialRole);
  const [rollNumber, setRollNumber] = useState('');
  const [dob, setDob] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [password, setPassword] = useState('');

  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaProblem, setCaptchaProblem] = useState({ a: 4, b: 3, answer: 7 });
  const [showDemoDrawer, setShowDemoDrawer] = useState(false);

  const generateCaptcha = () => {
    const a = Math.floor(Math.random() * 8) + 1;
    const b = Math.floor(Math.random() * 8) + 1;
    setCaptchaProblem({ a, b, answer: a + b });
    setCaptchaAnswer('');
  };

  useEffect(() => {
    setError('');
  }, [role]);

  const handleRoleChange = (newRole: NormalizedRole) => {
    setRole(newRole);
    setError('');
  };

  const handleAutoFillStudent = (roll: string, dateOfBirth: string) => {
    setRollNumber(roll);
    setDob(dateOfBirth);
    setError('');
  };

  const handleAutoFillFaculty = (facId: string, pwd: string) => {
    setFacultyId(facId);
    setPassword(pwd);
    setError('');
  };

  const validateForm = (): boolean => {
    setError('');
    if (role === 'student') {
      if (!rollNumber.trim()) {
        setError('Please enter your Roll Number (e.g. 24BCE0480)');
        return false;
      }
      const rollRegex = /^[0-9]{2}[A-Z]{3}[0-9]{4}$/i;
      if (!rollRegex.test(rollNumber.trim())) {
        setError('Format required: 24BCE0480 (2 digits + 3 letters + 4 digits)');
        return false;
      }
      if (!dob) {
        setError('Please select your Date of Birth');
        return false;
      }
    } else {
      if (!facultyId.trim()) {
        setError('Please enter your Faculty ID (e.g. FAC001)');
        return false;
      }
      const facRegex = /^FAC[0-9]{3}$/i;
      if (!facRegex.test(facultyId.trim())) {
        setError('Format required: FAC001 (FAC + 3 digits)');
        return false;
      }
      if (!password) {
        setError('Please enter your password');
        return false;
      }
    }

    if (showCaptcha) {
      if (parseInt(captchaAnswer.trim(), 10) !== captchaProblem.answer) {
        setError('Incorrect CAPTCHA answer.');
        generateCaptcha();
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError('');

    const identifier = role === 'student' ? rollNumber.trim().toUpperCase() : facultyId.trim().toUpperCase();
    const secret = role === 'student' ? dob : password;

    const result = await login({ identifier, secret, role });

    setIsSubmitting(false);

    if (!result.success) {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      setError(result.error || 'Authentication failed. Check your credentials.');

      if (nextAttempts >= 3 && !showCaptcha) {
        setShowCaptcha(true);
        generateCaptcha();
      }
      return;
    }

    router.replace(role === 'faculty' ? '/faculty' : '/student');
  };

  return (
    <div className="w-full max-w-md bg-white border border-paper-3 rounded-md p-8 sm:p-12 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] space-y-6">
      {/* Tab Switcher */}
      <RoleTabs activeRole={role} onChange={handleRoleChange} />

      <div className="space-y-1">
        <h2 className="font-instrument text-2xl text-ink-0">
          {role === 'student' ? 'Student Sign In' : 'Faculty Sign In'}
        </h2>
        <p className="text-xs text-ink-2 font-inter">
          {role === 'student'
            ? 'Enter your Roll Number and Date of Birth'
            : 'Enter your Faculty ID and account password'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <AnimatePresence mode="wait">
          {role === 'student' ? (
            <motion.div
              key="student-fields"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase tracking-widest text-ink-3 font-medium block">
                  ROLL NUMBER
                </label>
                <input
                  type="text"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. 24BCE0480"
                  maxLength={9}
                  className="w-full py-2 text-sm font-dmsans bg-transparent border-b border-paper-3 text-ink-0 uppercase placeholder:text-ink-3 focus:border-b-2 focus:border-terracotta outline-none transition-all"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase tracking-widest text-ink-3 font-medium block">
                  DATE OF BIRTH (PASSWORD)
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full py-2 text-sm font-dmsans bg-transparent border-b border-paper-3 text-ink-0 focus:border-b-2 focus:border-terracotta outline-none transition-all"
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="faculty-fields"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase tracking-widest text-ink-3 font-medium block">
                  FACULTY ID
                </label>
                <input
                  type="text"
                  value={facultyId}
                  onChange={(e) => setFacultyId(e.target.value.toUpperCase())}
                  placeholder="e.g. FAC001"
                  maxLength={6}
                  className="w-full py-2 text-sm font-dmsans bg-transparent border-b border-paper-3 text-ink-0 uppercase placeholder:text-ink-3 focus:border-b-2 focus:border-navy outline-none transition-all"
                  autoFocus
                />
              </div>

              <PasswordInput
                label="PASSWORD"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                accentColor="navy"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {showCaptcha && (
          <div className="p-3 rounded bg-mustard-light border border-mustard/30 space-y-2">
            <div className="flex items-center justify-between text-xs text-ink-1 font-mono">
              <span>Security: {captchaProblem.a} + {captchaProblem.b} = ?</span>
              <button type="button" onClick={generateCaptcha} className="text-ink-3 hover:text-ink-0">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="number"
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value)}
              className="w-full py-1 px-2 text-xs bg-white border border-paper-3 rounded text-ink-0 outline-none"
            />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-burgundy bg-burgundy-light p-2.5 rounded border border-burgundy/20 font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-ink-2 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-paper-3 text-terracotta focus:ring-0"
            />
            <span>Remember account</span>
          </label>
          <Link href="/forgot-password" className="hover:text-ink-0 underline">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'w-full h-[52px] rounded-sm text-xs font-semibold uppercase tracking-wider text-paper-0 shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50',
            role === 'student' ? 'bg-terracotta hover:bg-terracotta-hover' : 'bg-plum hover:bg-plum/90'
          )}
        >
          {isSubmitting ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>Sign In to {role === 'student' ? 'Student Portal' : 'Faculty Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Demo Credentials Footnote */}
      <div className="pt-4 space-y-3">
        <HairlineRule />
        <button
          type="button"
          onClick={() => setShowDemoDrawer((v) => !v)}
          className="w-full flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-ink-3 hover:text-ink-1 transition-colors"
        >
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-terracotta" />
            Demo Credentials
          </span>
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showDemoDrawer && 'rotate-180')} />
        </button>

        {showDemoDrawer && (
          <div className="p-3 bg-paper-1 rounded border border-paper-3 font-mono text-[11px] space-y-2">
            {role === 'student' ? (
              <div className="space-y-1">
                {DEMO_CREDENTIALS.students.map((st) => (
                  <button
                    key={st.rollNumber}
                    type="button"
                    onClick={() => handleAutoFillStudent(st.rollNumber, st.dob)}
                    className="w-full text-left p-1.5 hover:bg-paper-2 rounded flex justify-between items-center transition-colors"
                  >
                    <span className="font-semibold text-ink-0">{st.name}</span>
                    <span className="text-ink-2">{st.rollNumber} | {st.dob}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {DEMO_CREDENTIALS.faculty.map((fc) => (
                  <button
                    key={fc.facultyId}
                    type="button"
                    onClick={() => handleAutoFillFaculty(fc.facultyId, fc.password)}
                    className="w-full text-left p-1.5 hover:bg-paper-2 rounded flex justify-between items-center transition-colors"
                  >
                    <span className="font-semibold text-ink-0">{fc.name}</span>
                    <span className="text-ink-2">{fc.facultyId} | {fc.password}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
