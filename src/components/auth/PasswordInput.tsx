'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  accentColor?: 'terracotta' | 'navy' | 'plum';
}

export function PasswordInput({
  label = 'PASSWORD',
  error,
  accentColor = 'navy',
  className,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-1 relative">
      {label && (
        <label className="text-[11px] font-mono uppercase tracking-widest text-ink-3 font-medium block">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          className={cn(
            'w-full py-2 pr-8 text-sm font-dmsans bg-transparent border-b border-paper-3 text-ink-0 placeholder:text-ink-3 outline-none transition-all',
            accentColor === 'terracotta' && 'focus:border-b-2 focus:border-terracotta',
            accentColor === 'navy' && 'focus:border-b-2 focus:border-navy',
            accentColor === 'plum' && 'focus:border-b-2 focus:border-plum',
            error && 'border-b-2 border-burgundy',
            className
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute right-0 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-0 transition-colors p-1"
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-burgundy font-medium mt-1">{error}</p>}
    </div>
  );
}
