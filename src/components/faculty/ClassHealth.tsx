'use client';

import { motion } from 'framer-motion';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

export function ClassHealth() {
  const { students } = useAppStore();

  const total = students.length;
  const healthy = students.filter(s => s.riskLevel === 'LOW').length;
  const medium = students.filter(s => s.riskLevel === 'MEDIUM').length;
  const atRisk = students.filter(s => s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL').length;

  const stats = [
    { label: 'Total Students', value: total, icon: '👥', color: 'text-white' },
    { label: 'Healthy', value: healthy, icon: '✅', color: 'text-emerald-400' },
    { label: 'Needs Attention', value: medium, icon: '⚠️', color: 'text-amber-400' },
    { label: 'At Risk', value: atRisk, icon: '🔴', color: 'text-red-400' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#111722] border border-white/5 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium">Class Health Overview</h3>
          <p className="text-xs text-muted-foreground">Cohort distribution and real-time risk classification</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/5 px-3 py-1 rounded-full border border-white/5">
          <span>Cohort Avg Health:</span>
          <span className="font-bold text-emerald-400">76.4%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="text-center p-4 rounded-xl bg-[#0D111A] border border-white/5"
          >
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className={cn('text-2xl font-bold', stat.color)}>
              <AnimatedNumber value={stat.value} />
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-medium">{stat.label}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
