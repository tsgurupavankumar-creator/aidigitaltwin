'use client';

import { motion } from 'framer-motion';
import { mockHeatmapData } from '@/data/mockData';

export function KnowledgeHeatmap() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#111722] border border-white/5 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-medium">Cohort Knowledge Gap Heatmap</h3>
          <p className="text-xs text-muted-foreground">Class-wide concept mastery and weakness distribution</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-400/80" /> Critical Weakness (&lt;50%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-400/80" /> Moderate Gap (50-70%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-400/80" /> Proficient (&gt;70%)
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {mockHeatmapData.map((item, index) => {
          const total = item.critical + item.weak + item.proficient;
          const critPct = Math.round((item.critical / total) * 100);
          const weakPct = Math.round((item.weak / total) * 100);
          const profPct = Math.round((item.proficient / total) * 100);

          return (
            <motion.div
              key={item.topic}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 }}
              className="p-4 rounded-xl bg-[#0D111A] border border-white/5"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-200">{item.topic}</span>
                <span className="text-xs text-muted-foreground">
                  <strong className="text-red-400">{item.critical} students</strong> in critical tier
                </span>
              </div>

              {/* Multi-segment Progress bar */}
              <div className="h-3 rounded-full bg-white/5 overflow-hidden flex">
                <div style={{ width: `${critPct}%` }} className="h-full bg-red-400 transition-all duration-500" title={`Critical: ${item.critical} students (${critPct}%)`} />
                <div style={{ width: `${weakPct}%` }} className="h-full bg-amber-400 transition-all duration-500" title={`Weak: ${item.weak} students (${weakPct}%)`} />
                <div style={{ width: `${profPct}%` }} className="h-full bg-emerald-400 transition-all duration-500" title={`Proficient: ${item.proficient} students (${profPct}%)`} />
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span className="text-red-400 font-medium">Critical: {critPct}%</span>
                  <span className="text-amber-400 font-medium">Needs Attention: {weakPct}%</span>
                  <span className="text-emerald-400 font-medium">Proficient: {profPct}%</span>
                </div>
                <button className="text-xs text-primary hover:text-secondary font-medium transition-colors">
                  Trigger Cohort Session →
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
