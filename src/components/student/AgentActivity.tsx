'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Circle,
  ChevronRight,
  Play,
  Pause,
  Send,
  Sparkles,
  Terminal,
  X,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

export function AgentActivity() {
  const {
    agents,
    triggerAgentRun,
    toggleAgentPause,
    sendAgentDirective,
    runAllAgents,
  } = useAppStore();

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PROCESSING' | 'WAITING'>('ALL');
  const [directiveInput, setDirectiveInput] = useState('');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const isAnyProcessing = agents.some((a) => a.status === 'PROCESSING');

  const filteredAgents = agents.filter((agent) => {
    if (statusFilter === 'ALL') return true;
    return agent.status === statusFilter;
  });

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  const handleRunAll = () => {
    runAllAgents();
    showToast('Batch execution dispatched to all autonomous agents!');
  };

  const handleTriggerSingle = (agentId: string, name: string) => {
    triggerAgentRun(agentId);
    showToast(`Triggered instant telemetry audit for ${name}`);
  };

  const handleTogglePause = (agentId: string, name: string, currentStatus: string) => {
    toggleAgentPause(agentId);
    showToast(currentStatus === 'WAITING' ? `Resumed monitoring for ${name}` : `Paused ${name}`);
  };

  const handleSendDirective = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedAgent || !directiveInput.trim()) return;

    sendAgentDirective(selectedAgent.id, directiveInput.trim());
    showToast(`Directive sent to ${selectedAgent.name}: "${directiveInput.trim()}"`);
    setDirectiveInput('');
  };

  const handleQuickDirective = (directive: string) => {
    if (!selectedAgent) return;
    sendAgentDirective(selectedAgent.id, directive);
    showToast(`Dispatched directive: "${directive}"`);
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400';
      case 'PROCESSING':
        return 'bg-amber-400/10 border-amber-400/20 text-amber-400';
      case 'WAITING':
        return 'bg-white/5 border-white/10 text-muted-foreground';
      default:
        return 'bg-white/5 border-white/10 text-muted-foreground';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl bg-[#111722] border border-white/5 p-6 shadow-xl"
    >
      {/* Notification Toast */}
      <AnimatePresence>
        {feedbackToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-primary/90 text-white text-xs font-medium shadow-lg backdrop-blur flex items-center gap-2 border border-primary/40"
          >
            <Sparkles className="w-3.5 h-3.5 text-secondary animate-pulse" />
            <span>{feedbackToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-white">AI Agent Swarm</h3>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <p className="text-xs text-muted-foreground">Autonomous cognitive vectors monitoring your digital twin</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunAll}
            disabled={isAnyProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary hover:text-white text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Play className={cn('w-3.5 h-3.5', isAnyProcessing && 'animate-spin')} />
            <span>{isAnyProcessing ? 'Auditing...' : 'Run All Agents'}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/5 mb-4 overflow-x-auto">
        {(['ALL', 'ACTIVE', 'PROCESSING', 'WAITING'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize',
              statusFilter === tab
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted-foreground hover:text-white'
            )}
          >
            {tab.toLowerCase()} ({tab === 'ALL' ? agents.length : agents.filter((a) => a.status === tab).length})
          </button>
        ))}
      </div>

      {/* Agents List */}
      <div className="space-y-2">
        {filteredAgents.map((agent, index) => {
          const isProcessing = agent.status === 'PROCESSING';
          const isWaiting = agent.status === 'WAITING';

          return (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04 }}
              onClick={() => setSelectedAgentId(agent.id)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl transition-all group cursor-pointer border',
                selectedAgentId === agent.id
                  ? 'bg-primary/10 border-primary/30 shadow-md'
                  : 'bg-[#0D111A]/60 border-white/5 hover:border-white/10 hover:bg-white/5'
              )}
            >
              <span className="text-xl p-2 rounded-lg bg-white/5 group-hover:scale-105 transition-transform flex-shrink-0">
                {agent.icon}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-slate-200 truncate">{agent.name}</span>
                  <div className={cn('flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border', getStatusBg(agent.status))}>
                    <Circle className={cn('w-1.5 h-1.5 fill-current', agent.status === 'ACTIVE' && 'animate-pulse')} />
                    <span>{agent.status}</span>
                  </div>
                  <span className="hidden sm:inline-block text-[10px] text-muted-foreground/60 px-1.5 py-0.5 rounded bg-white/5">
                    {agent.frequency || 'Continuous'}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground truncate">
                  {agent.currentTask || agent.task}
                </div>

                {isProcessing && (
                  <div className="mt-1.5 w-full bg-white/5 h-1 rounded-full overflow-hidden">
                    <motion.div
                      className="bg-amber-400 h-full rounded-full"
                      initial={{ width: '10%' }}
                      animate={{ width: `${agent.progress || 75}%` }}
                      transition={{ duration: 1.5, repeat: Infinity, repeatType: 'reverse' }}
                    />
                  </div>
                )}

                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/60">
                  <span>Last run: {agent.lastRun || 'Just now'}</span>
                  <span>•</span>
                  <span>Mode: {agent.mode || 'Autonomous'}</span>
                </div>
              </div>

              {/* Quick Inline Actions */}
              <div className="flex items-center gap-1 flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTriggerSingle(agent.id, agent.name);
                  }}
                  disabled={isProcessing}
                  title="Run this agent now"
                  className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors disabled:opacity-40"
                >
                  <Play className={cn('w-3.5 h-3.5', isProcessing && 'animate-spin text-amber-400')} />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePause(agent.id, agent.name, agent.status);
                  }}
                  title={isWaiting ? 'Resume agent' : 'Pause agent'}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                >
                  <Pause className="w-3.5 h-3.5" />
                </button>

                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </div>
            </motion.div>
          );
        })}

        {filteredAgents.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-xs">
            No agents found matching &ldquo;{statusFilter.toLowerCase()}&rdquo;.
          </div>
        )}
      </div>

      {/* Interactive Agent Inspection & Directive Modal */}
      <AnimatePresence>
        {selectedAgent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg rounded-2xl bg-[#0D111A] border border-white/10 p-6 shadow-2xl relative max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <span className="text-3xl p-2.5 rounded-xl bg-white/5 border border-white/5">
                    {selectedAgent.icon}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-semibold text-white">{selectedAgent.name}</h4>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', getStatusBg(selectedAgent.status))}>
                        {selectedAgent.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedAgent.task}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAgentId(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                {/* Agent Telemetry Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">Mode</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block">{selectedAgent.mode || 'Autonomous'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">Frequency</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block">{selectedAgent.frequency || 'Continuous'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 col-span-2 sm:col-span-1">
                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">Last Run</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block">{selectedAgent.lastRun || 'Just now'}</span>
                  </div>
                </div>

                {/* Control Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTriggerSingle(selectedAgent.id, selectedAgent.name)}
                    disabled={selectedAgent.status === 'PROCESSING'}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold transition-all disabled:opacity-50 shadow-md shadow-primary/20"
                  >
                    <Play className={cn('w-3.5 h-3.5', selectedAgent.status === 'PROCESSING' && 'animate-spin')} />
                    <span>{selectedAgent.status === 'PROCESSING' ? 'Processing Vector...' : 'Trigger Run Now'}</span>
                  </button>

                  <button
                    onClick={() => handleTogglePause(selectedAgent.id, selectedAgent.name, selectedAgent.status)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors',
                      selectedAgent.status === 'WAITING'
                        ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/20'
                        : 'bg-white/5 border-white/10 text-muted-foreground hover:text-white hover:bg-white/10'
                    )}
                  >
                    {selectedAgent.status === 'WAITING' ? (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Resume Monitoring</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause Agent</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Send Directive Prompt */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-secondary" />
                      Direct Agent Action
                    </span>
                    <span className="text-[10px] text-muted-foreground">NLP Vector Prompt</span>
                  </div>

                  <form onSubmit={handleSendDirective} className="flex gap-2">
                    <input
                      type="text"
                      value={directiveInput}
                      onChange={(e) => setDirectiveInput(e.target.value)}
                      placeholder={`Instruct ${selectedAgent.name} (e.g. Audit Quiz 2 score)...`}
                      className="flex-1 bg-[#111722] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    />
                    <button
                      type="submit"
                      disabled={!directiveInput.trim()}
                      className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      <span>Dispatch</span>
                    </button>
                  </form>

                  {/* Quick Directive Suggestions */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      'Scan DBMS normalization gaps',
                      'Recalculate GPA confidence interval',
                      'Check OS Deadlock retention risk',
                      'Optimize study schedule for exam',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleQuickDirective(preset)}
                        className="text-[10px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white border border-white/5 transition-colors"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Activity Telemetry Logs */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      Real-time Execution Telemetry
                    </span>
                    <span className="text-[10px] text-muted-foreground">Live log stream</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#080B11] border border-white/5 font-mono text-[11px] space-y-1.5 max-h-40 overflow-y-auto">
                    {selectedAgent.logs && selectedAgent.logs.length > 0 ? (
                      selectedAgent.logs.map((log, idx) => (
                        <div key={idx} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-muted-foreground/60 select-none">[{log.timestamp}]</span>
                          <span
                            className={cn(
                              'flex-1',
                              log.type === 'success' && 'text-emerald-400',
                              log.type === 'warn' && 'text-amber-400',
                              (log.type === 'info' || !log.type) && 'text-slate-300'
                            )}
                          >
                            {log.message}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted-foreground/50 text-center py-3">
                        Telemetry initialized. Awaiting next periodic cycle.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-white/5 flex justify-end">
                <button
                  onClick={() => setSelectedAgentId(null)}
                  className="px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-200 transition-colors"
                >
                  Close Inspector
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
