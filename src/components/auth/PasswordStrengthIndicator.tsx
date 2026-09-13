'use client';

import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
}

export interface PasswordRules {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export function checkPasswordStrength(password: string): PasswordRules {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*]/.test(password),
  };
}

export function isPasswordValid(password: string): boolean {
  const rules = checkPasswordStrength(password);
  return (
    rules.minLength &&
    rules.hasUppercase &&
    rules.hasLowercase &&
    rules.hasNumber &&
    rules.hasSpecial
  );
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  const rules = checkPasswordStrength(password);
  const passedCount = Object.values(rules).filter(Boolean).length;

  let strengthLabel = 'Weak';
  let barColor = 'bg-burgundy';

  if (passedCount >= 5) {
    strengthLabel = 'Strong';
    barColor = 'bg-olive';
  } else if (passedCount >= 3) {
    strengthLabel = 'Medium';
    barColor = 'bg-mustard';
  }

  const checklistItems = [
    { label: 'At least 8 characters', valid: rules.minLength },
    { label: 'At least 1 uppercase letter (A-Z)', valid: rules.hasUppercase },
    { label: 'At least 1 lowercase letter (a-z)', valid: rules.hasLowercase },
    { label: 'At least 1 number (0-9)', valid: rules.hasNumber },
    { label: 'At least 1 special character (!@#$%^&*)', valid: rules.hasSpecial },
  ];

  return (
    <div className="space-y-2.5 pt-1 text-xs">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-ink-3 uppercase">PASSWORD STRENGTH:</span>
          <span className={cn('font-semibold', passedCount === 5 ? 'text-olive' : passedCount >= 3 ? 'text-mustard' : 'text-burgundy')}>
            {strengthLabel} ({passedCount}/5)
          </span>
        </div>
        <div className="w-full h-1.5 bg-paper-2 rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all duration-300 rounded-full', barColor)}
            style={{ width: `${(passedCount / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Rules Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
        {checklistItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 text-[11px] font-mono">
            {item.valid ? (
              <Check className="w-3.5 h-3.5 text-olive flex-shrink-0" />
            ) : (
              <X className="w-3.5 h-3.5 text-ink-3 flex-shrink-0" />
            )}
            <span className={item.valid ? 'text-ink-0 font-medium' : 'text-ink-3'}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
