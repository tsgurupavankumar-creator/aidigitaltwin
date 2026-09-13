'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from './AnimatedNumber';

interface MetricCardProps {
  title: string;
  value: number;
  unit?: string;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  color?: string;
}

export function MetricCard({
  title,
  value,
  unit = '%',
  change,
  changeLabel = 'vs last period',
  icon: Icon,
  color = 'text-primary',
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl bg-[#111722] border border-white/5 relative overflow-hidden card-hover"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        {Icon && (
          <div className={cn('p-2 rounded-xl bg-white/5', color)}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        <AnimatedNumber value={value} className="text-2xl font-bold tracking-tight" />
        <span className="text-sm font-semibold text-muted-foreground">{unit}</span>
      </div>

      {change !== undefined && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          <span className={cn('font-medium', change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {change >= 0 ? '↑ +' : '↓ '}{change}%
          </span>
          <span className="text-muted-foreground/60">{changeLabel}</span>
        </div>
      )}
    </motion.div>
  );
}
