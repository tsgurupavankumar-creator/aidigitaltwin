'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Info,
  AlertCircle,
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  ArrowRight,
  RotateCcw,
  Search,
  PlusCircle,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { Alert } from '@/lib/types';

interface EarlyWarningsProps {
  allowAddTest?: boolean;
}

export function EarlyWarnings({ allowAddTest = true }: EarlyWarningsProps) {
  const {
    alerts,
    dismissAlert,
    resolveAlert,
    restoreAlert,
    addAlert,
    addTask,
  } = useAppStore();

  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'CRITICAL' | 'WARNING' | 'RESOLVED' | 'ALL'>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const selectedAlert = alerts.find((a) => a.id === selectedAlertId);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  const getAlertStyles = (type: string) => {
    switch (type) {
      case 'CRITICAL':
        return { icon: AlertCircle, bg: 'bg-red-400/10 border-red-400/20', color: 'text-red-400', badge: 'bg-red-400/20 text-red-400' };
      case 'WARNING':
        return { icon: AlertTriangle, bg: 'bg-amber-400/10 border-amber-400/20', color: 'text-amber-400', badge: 'bg-amber-400/20 text-amber-400' };
      default:
        return { icon: Info, bg: 'bg-primary/10 border-primary/20', color: 'text-primary', badge: 'bg-primary/20 text-primary' };
    }
  };

  // Filter alerts based on active tab & search
  const filteredAlerts = alerts.filter((alert) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        alert.title.toLowerCase().includes(q) ||
        alert.message.toLowerCase().includes(q) ||
        (alert.rootCause && alert.rootCause.toLowerCase().includes(q));
      if (!match) return false;
    }

    if (activeTab === 'ACTIVE') {
      return !alert.dismissed && !alert.resolved;
    }
    if (activeTab === 'CRITICAL') {
      return alert.type === 'CRITICAL' && !alert.dismissed && !alert.resolved;
    }
    if (activeTab === 'WARNING') {
      return alert.type === 'WARNING' && !alert.dismissed && !alert.resolved;
    }
    if (activeTab === 'RESOLVED') {
      return alert.resolved === true;
    }
    return true; // 'ALL'
  });

  const activeCount = alerts.filter((a) => !a.dismissed && !a.resolved).length;
  const criticalCount = alerts.filter((a) => a.type === 'CRITICAL' && !a.dismissed && !a.resolved).length;
  const warningCount = alerts.filter((a) => a.type === 'WARNING' && !a.dismissed && !a.resolved).length;
  const resolvedCount = alerts.filter((a) => a.resolved).length;

  const handleResolveAlert = (alertId: string, title: string) => {
    resolveAlert(alertId);
    setSelectedAlertId(null);
    showToast(`Remediation applied! "${title}" resolved & +3 Twin Health awarded.`);
  };

  const handleAddToStudyPlan = (alert: Alert) => {
    const actionName = alert.remediation?.actionName || `Remediate: ${alert.title}`;
    const desc = alert.remediation?.description || alert.message;
    addTask({
      title: actionName,
      description: desc,
      priority: alert.type === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
      time: 25,
      estimatedTime: 25,
      dueDate: 'Today',
      completed: false,
      subject: 'Remediation',
    });
    showToast(`Added "${actionName}" to your AI Study Plan!`);
  };

  const handleTriggerTestWarning = () => {
    const testId = `alert-${Date.now()}`;
    const samples = [
      {
        title: 'OS Process Concurrency Lag',
        message: 'Telemetry detects 3 skipped practice problems in POSIX threads synchronization.',
        type: 'WARNING' as const,
        impact: 'MEDIUM' as const,
        rootCause: 'Lack of hands-on mutex locks exercise submission prior to Friday lab test.',
        remediation: {
          actionName: 'Complete POSIX Threads Lab Exercise',
          description: 'Review pthread_mutex_lock implementations and submit verification test.',
          impactEstimate: '+5% Practical Skills Vector Boost',
        },
      },
      {
        title: 'Midterm Weight Trajectory Dip',
        message: 'Composite midterm confidence boundary fell below 78% threshold.',
        type: 'CRITICAL' as const,
        impact: 'HIGH' as const,
        rootCause: 'Cumulative scores across Quiz 2 and Quiz 3 lag behind target by 8.4 points.',
        remediation: {
          actionName: 'Launch Comprehensive Midterm Diagnostic',
          description: 'Take 20-minute adaptive diagnostic across DBMS and Operating Systems foundations.',
          impactEstimate: '+10% Twin Assessment Trajectory',
        },
      },
    ];

    const pick = samples[Math.floor(Math.random() * samples.length)];
    addAlert({
      id: testId,
      title: pick.title,
      message: pick.message,
      type: pick.type,
      impact: pick.impact,
      timestamp: 'Just now',
      time: 'Just now',
      dismissed: false,
      resolved: false,
      rootCause: pick.rootCause,
      remediation: pick.remediation,
    });
    showToast(`Simulated real-time trigger: "${pick.title}" fired!`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl bg-[#111722] border border-white/5 p-6 shadow-xl"
    >
      {/* Toast Feedback */}
      <AnimatePresence>
        {feedbackToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-emerald-500/90 text-white text-xs font-semibold shadow-lg backdrop-blur flex items-center gap-2 border border-emerald-400/40"
          >
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span>{feedbackToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-white">Early Warning System</h3>
            {criticalCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">Real-time risk alerts and threshold warnings</p>
        </div>

        <div className="flex items-center gap-2">
          {allowAddTest && (
            <button
              onClick={handleTriggerTestWarning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulate Trigger</span>
            </button>
          )}

          {activeCount > 0 ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-red-400/10 border border-red-400/20 text-red-400 font-semibold">
              {activeCount} active risk{activeCount > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> All Optimal
            </span>
          )}
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-4">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ACTIVE')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
              activeTab === 'ACTIVE'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted-foreground hover:text-white'
            )}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setActiveTab('CRITICAL')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
              activeTab === 'CRITICAL'
                ? 'bg-red-400/20 text-red-400 border border-red-400/30'
                : 'text-muted-foreground hover:text-white'
            )}
          >
            Critical ({criticalCount})
          </button>
          <button
            onClick={() => setActiveTab('WARNING')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
              activeTab === 'WARNING'
                ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30'
                : 'text-muted-foreground hover:text-white'
            )}
          >
            Warnings ({warningCount})
          </button>
          <button
            onClick={() => setActiveTab('RESOLVED')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
              activeTab === 'RESOLVED'
                ? 'bg-emerald-400/20 text-emerald-400 border border-emerald-400/30'
                : 'text-muted-foreground hover:text-white'
            )}
          >
            Resolved ({resolvedCount})
          </button>
        </div>

        <div className="relative min-w-[180px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search warnings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0D111A] border border-white/5 rounded-xl pl-8 pr-3 py-1 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredAlerts.map((alert) => {
            const styles = getAlertStyles(alert.type);

            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                whileHover={{ x: 3 }}
                onClick={() => setSelectedAlertId(alert.id)}
                className={cn(
                  'p-4 rounded-xl border transition-all cursor-pointer group',
                  styles.bg,
                  selectedAlertId === alert.id && 'ring-2 ring-primary/40'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('mt-0.5 p-1.5 rounded-lg bg-white/5', styles.color)}>
                    {alert.resolved ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : alert.type === 'CRITICAL' ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : alert.type === 'WARNING' ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <Info className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white group-hover:text-primary transition-colors">
                        {alert.title}
                      </span>
                      {alert.impact === 'HIGH' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-400/20 text-red-400 font-medium">
                          High Impact
                        </span>
                      )}
                      {alert.resolved && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-400 font-medium">
                          Resolved
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {alert.message}
                    </p>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
                        <span>{alert.time || alert.timestamp || 'Real-time telemetry'}</span>
                        {alert.remediation && (
                          <span className="hidden sm:inline-block text-emerald-400/80">
                            • {alert.remediation.impactEstimate}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!alert.resolved ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResolveAlert(alert.id, alert.title);
                              }}
                              className="text-xs px-2.5 py-1 rounded-lg bg-emerald-400/10 hover:bg-emerald-400/20 text-emerald-400 font-semibold border border-emerald-400/20 transition-colors"
                            >
                              Remediate
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAlertId(alert.id);
                              }}
                              className="text-xs text-primary hover:text-white font-medium transition-colors flex items-center gap-1"
                            >
                              <span>Deep Analysis</span>
                              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              restoreAlert(alert.id);
                              showToast(`Restored "${alert.title}" to active warnings.`);
                            }}
                            className="text-xs text-muted-foreground hover:text-white flex items-center gap-1 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Re-open</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {!alert.resolved && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissAlert(alert.id);
                      }}
                      title="Dismiss alert"
                      className="p-1 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0 text-muted-foreground hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredAlerts.length === 0 && (
          <div className="text-center py-10 rounded-xl bg-[#0D111A]/40 border border-white/5">
            <div className="text-4xl mb-2">🎯</div>
            <p className="text-sm font-medium text-slate-200">
              {activeTab === 'RESOLVED'
                ? 'No resolved alerts in history yet.'
                : 'No alerts matching your filter. Digital Twin state is optimal.'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Autonomous cognitive agents are monitoring telemetry continuously.
            </p>
          </div>
        )}
      </div>

      {/* Deep Analysis & AI Remediation Modal */}
      <AnimatePresence>
        {selectedAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-xl rounded-2xl bg-[#0D111A] border border-white/10 p-6 shadow-2xl relative max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2.5 rounded-xl border', getAlertStyles(selectedAlert.type).bg, getAlertStyles(selectedAlert.type).color)}>
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-semibold text-white">{selectedAlert.title}</h4>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold uppercase', getAlertStyles(selectedAlert.type).badge)}>
                        {selectedAlert.type}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{selectedAlert.time || selectedAlert.timestamp}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAlertId(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                {/* Issue Context */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Telemetry Trigger Description
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed">{selectedAlert.message}</p>
                </div>

                {/* Root Cause Analysis */}
                <div className="p-3.5 rounded-xl bg-red-400/5 border border-red-400/15 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Cognitive Root Cause Analysis</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedAlert.rootCause ||
                      'Drift identified in baseline cognitive vector response time and prerequisite concept mastery.'}
                  </p>
                </div>

                {/* AI Prescribed Remediation */}
                <div className="p-4 rounded-xl bg-emerald-400/5 border border-emerald-400/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Prescribed AI Remediation</span>
                    </div>
                    {selectedAlert.remediation?.impactEstimate && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-400 font-semibold">
                        {selectedAlert.remediation.impactEstimate}
                      </span>
                    )}
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-white">
                      {selectedAlert.remediation?.actionName || 'Targeted Concept Review Session'}
                    </h5>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedAlert.remediation?.description ||
                        'Run an adaptive self-test with targeted reinforcement to close vector deficiencies.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleAddToStudyPlan(selectedAlert)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium border border-white/10 transition-colors"
                    >
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      <span>Add to Study Plan</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    dismissAlert(selectedAlert.id);
                    setSelectedAlertId(null);
                    showToast(`Dismissed "${selectedAlert.title}".`);
                  }}
                  className="px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-white transition-colors"
                >
                  Dismiss Warning
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedAlertId(null)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition-colors"
                  >
                    Close
                  </button>

                  {!selectedAlert.resolved && (
                    <button
                      onClick={() => handleResolveAlert(selectedAlert.id, selectedAlert.title)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-lg shadow-primary/20 transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Apply Remediation & Resolve</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
