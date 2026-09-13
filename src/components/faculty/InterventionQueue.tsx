'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Send, CheckCircle2, UserCheck, BookOpen, Clock } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { StatusBadge } from '../ui/StatusBadge';

export function InterventionQueue() {
  const { interventions, dispatchIntervention } = useAppStore();

  const getInterventionIcon = (type: string) => {
    switch (type) {
      case 'TUTORING': return <UserCheck className="w-4 h-4 text-cyan-400" />;
      case 'MEETING': return <Clock className="w-4 h-4 text-red-400" />;
      case 'QUIZ': return <BookOpen className="w-4 h-4 text-amber-400" />;
      default: return <Send className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#111722] border border-white/5 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-medium">AI Recommended Interventions</h3>
          <p className="text-xs text-muted-foreground">Automated remediation plans awaiting faculty dispatch</p>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-semibold">
          {interventions.filter(i => i.status === 'PENDING').length} Pending Approval
        </span>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {interventions.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 rounded-xl bg-[#0D111A] border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-2.5 rounded-xl bg-white/5 mt-0.5">
                  {getInterventionIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">{item.title}</span>
                    <StatusBadge status={item.riskLevel} />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">{item.description}</p>
                  <div className="flex items-center gap-4 text-[11px] text-slate-400">
                    <span>Student: <strong className="text-white">{item.studentName}</strong></span>
                    <span>Action: <strong className="text-primary">{item.suggestedAction}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end md:self-center flex-shrink-0">
                {item.status === 'PENDING' ? (
                  <button
                    onClick={() => dispatchIntervention(item.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-xs transition-colors shadow-lg shadow-primary/20"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Dispatch Plan</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-xl border border-emerald-400/20 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Dispatched</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
