'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  CheckCircle,
  Circle,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  X,
  Sparkles,
  CheckCircle2,
  Filter,
  Search,
  Timer,
  BookOpen,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { StudyTask } from '@/lib/types';

interface StudyPlanProps {
  showTitle?: boolean;
}

export function StudyPlan({ showTitle = true }: StudyPlanProps) {
  const {
    tasks,
    toggleTaskCompleted,
    addTask,
    deleteTask,
  } = useAppStore();

  const [activeSessionTask, setActiveSessionTask] = useState<StudyTask | null>(null);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'HIGH'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Focus Timer States
  const [timerSeconds, setTimerSeconds] = useState<number>(25 * 60);
  const [initialDuration, setInitialDuration] = useState<number>(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [sessionNotes, setSessionNotes] = useState<string>('');

  // Add Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskTag, setNewTaskTag] = useState('DBMS');
  const [newTaskTime, setNewTaskTime] = useState(25);
  const [newTaskPriority, setNewTaskPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [newTaskDueDate, setNewTaskDueDate] = useState('Today');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Timer Tick Effect
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      showToast('🎉 Focus session completed! Great work on maintaining cognitive flow.');
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const handleStartSession = (task: StudyTask) => {
    setActiveSessionTask(task);
    const duration = (task.time || (task as any).estimatedTime || 25) * 60;
    setInitialDuration(duration);
    setTimerSeconds(duration);
    setIsTimerRunning(true);
    setSessionNotes('');
  };

  const handleCompleteSession = () => {
    if (activeSessionTask) {
      if (!activeSessionTask.completed) {
        toggleTaskCompleted(activeSessionTask.id);
      }
      showToast(`Task "${activeSessionTask.title}" completed! +2 Digital Twin Health awarded.`);
    }
    setIsTimerRunning(false);
    setActiveSessionTask(null);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    addTask({
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim() || 'Focus session task planned by student.',
      subject: newTaskTag,
      estimatedTime: Number(newTaskTime) || 25,
      time: Number(newTaskTime) || 25,
      priority: newTaskPriority,
      dueDate: newTaskDueDate,
      completed: false,
    });

    setNewTaskTitle('');
    setNewTaskDesc('');
    setShowAddTaskModal(false);
    showToast(`Added "${newTaskTitle.trim()}" to your study plan!`);
  };

  // Filter Tasks
  const filteredTasks = tasks.filter((task) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        task.title.toLowerCase().includes(q) ||
        (task.description && task.description.toLowerCase().includes(q)) ||
        (task.subject && task.subject.toLowerCase().includes(q));
      if (!match) return false;
    }

    if (filterStatus === 'PENDING') return !task.completed;
    if (filterStatus === 'COMPLETED') return task.completed;
    if (filterStatus === 'HIGH') return !task.completed && task.priority === 'HIGH';
    return true; // 'ALL'
  });

  const completedCount = tasks.filter((t) => t.completed).length;
  const progressPercent = Math.round((completedCount / (tasks.length || 1)) * 100);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl bg-[#111722] border border-white/5 p-6 shadow-xl"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-primary/90 text-white text-xs font-semibold shadow-lg backdrop-blur flex items-center gap-2 border border-primary/40"
          >
            <Sparkles className="w-3.5 h-3.5 text-secondary animate-pulse" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-white">AI Study Plan</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
              {completedCount}/{tasks.length} Completed
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Dynamic schedule tailored to concept gaps & cognitive peaks</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddTaskModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-md shadow-primary/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Study Task</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-4">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/5 overflow-x-auto">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
              filterStatus === 'ALL'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted-foreground hover:text-white'
            )}
          >
            All Tasks ({tasks.length})
          </button>
          <button
            onClick={() => setFilterStatus('PENDING')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
              filterStatus === 'PENDING'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted-foreground hover:text-white'
            )}
          >
            Pending ({tasks.length - completedCount})
          </button>
          <button
            onClick={() => setFilterStatus('HIGH')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
              filterStatus === 'HIGH'
                ? 'bg-red-400/20 text-red-400 border border-red-400/30'
                : 'text-muted-foreground hover:text-white'
            )}
          >
            High Priority
          </button>
          <button
            onClick={() => setFilterStatus('COMPLETED')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
              filterStatus === 'COMPLETED'
                ? 'bg-emerald-400/20 text-emerald-400 border border-emerald-400/30'
                : 'text-muted-foreground hover:text-white'
            )}
          >
            Completed ({completedCount})
          </button>
        </div>

        <div className="relative min-w-[180px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search study tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0D111A] border border-white/5 rounded-xl pl-8 pr-3 py-1 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.map((task, index) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.04 }}
            className={cn(
              'flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300 group',
              task.completed
                ? 'border-white/5 bg-white/5 opacity-60'
                : 'border-white/10 hover:border-primary/30 bg-[#0D111A]/60'
            )}
          >
            {/* Checkbox */}
            <button
              onClick={() => {
                toggleTaskCompleted(task.id);
                showToast(task.completed ? `Marked pending: "${task.title}"` : `Completed "${task.title}"!`);
              }}
              className="flex-shrink-0 transition-transform active:scale-95 text-muted-foreground hover:text-white"
            >
              {task.completed ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground hover:text-white" />
              )}
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    'text-sm font-medium text-slate-200',
                    task.completed && 'line-through text-muted-foreground'
                  )}
                >
                  {task.title}
                </span>

                <span
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full font-semibold',
                    task.priority === 'HIGH'
                      ? 'bg-red-400/10 text-red-400 border border-red-400/20'
                      : task.priority === 'MEDIUM'
                      ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                      : 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                  )}
                >
                  {task.priority}
                </span>

                {task.subject && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground border border-white/5">
                    {task.subject}
                  </span>
                )}
              </div>

              <div className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</div>

              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 text-slate-400">
                  <Clock className="w-3 h-3 text-secondary" /> {task.dueDate}
                </span>
                <span>•</span>
                <span>{task.time || (task as any).estimatedTime || 25} min session</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Play Focus Session */}
              <button
                onClick={() => handleStartSession(task)}
                title="Start Focus Session"
                className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
              >
                <Play className="w-4 h-4 fill-current" />
              </button>

              {/* Delete Task */}
              <button
                onClick={() => {
                  deleteTask(task.id);
                  showToast(`Deleted task "${task.title}".`);
                }}
                title="Delete task"
                className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-red-400 transition-colors opacity-60 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}

        {filteredTasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-xs">
            No study tasks matching &ldquo;{filterStatus.toLowerCase()}&rdquo;. Click &ldquo;Add Study Task&rdquo; to plan one!
          </div>
        )}
      </div>

      {/* Daily Goal Progress Bar */}
      <div className="mt-5 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Daily Cognitive Goal Progress</span>
          <span className="font-semibold text-white">{progressPercent}% Completed</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5 }}
            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
          />
        </div>
      </div>

      {/* Interactive Focus Session Modal */}
      <AnimatePresence>
        {activeSessionTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              className="w-full max-w-md rounded-2xl bg-[#0D111A] border border-white/10 p-6 shadow-2xl relative flex flex-col items-center text-center"
            >
              <button
                onClick={() => {
                  setIsTimerRunning(false);
                  setActiveSessionTask(null);
                }}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 mb-3">
                <Timer className="w-8 h-8 animate-pulse" />
              </div>

              <h4 className="text-base font-bold text-white mb-1">Focus Study Mode</h4>
              <p className="text-xs text-muted-foreground mb-4 max-w-xs truncate">
                {activeSessionTask.title}
              </p>

              {/* Live Countdown Display */}
              <div className="relative w-48 h-48 flex flex-col items-center justify-center my-2">
                <div className="text-4xl font-mono font-extrabold text-white tracking-wider">
                  {formatTime(timerSeconds)}
                </div>
                <span className="text-[11px] text-muted-foreground mt-1 uppercase tracking-widest">
                  {isTimerRunning ? 'Deep Focus In Progress' : 'Session Paused'}
                </span>

                {/* Progress ring or bar indicator */}
                <div className="w-40 mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-1000"
                    style={{
                      width: `${Math.min(100, Math.max(0, ((initialDuration - timerSeconds) / initialDuration) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* Timer Presets */}
              <div className="flex items-center gap-2 mb-4">
                {[15, 25, 45].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => {
                      const dur = mins * 60;
                      setInitialDuration(dur);
                      setTimerSeconds(dur);
                      setIsTimerRunning(false);
                    }}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                      initialDuration === mins * 60
                        ? 'bg-primary/20 border-primary text-primary'
                        : 'bg-white/5 border-white/5 text-muted-foreground hover:text-white'
                    )}
                  >
                    {mins}m
                  </button>
                ))}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3 mb-5">
                <button
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-xs transition-all shadow-lg shadow-primary/20"
                >
                  {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>{isTimerRunning ? 'Pause Session' : 'Start Focus'}</span>
                </button>

                <button
                  onClick={() => {
                    setTimerSeconds(initialDuration);
                    setIsTimerRunning(false);
                  }}
                  title="Reset Timer"
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white border border-white/5 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Session Notes */}
              <div className="w-full text-left mb-4">
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Session Scratchpad
                </label>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Note key concepts, questions, or breakthroughs..."
                  className="w-full h-16 bg-[#111722] border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Finish & Complete */}
              <button
                onClick={handleCompleteSession}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Complete Task & Log Session</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Task Modal */}
      <AnimatePresence>
        {showAddTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-md rounded-2xl bg-[#0D111A] border border-white/10 p-6 shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold text-white">Create New Study Task</h4>
                </div>
                <button
                  onClick={() => setShowAddTaskModal(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="e.g. Master BCNF Decomposition"
                    className="w-full bg-[#111722] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Description & Objective
                  </label>
                  <textarea
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    placeholder="e.g. Solve 5 problems on lossless join decomposition..."
                    className="w-full h-16 bg-[#111722] border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Subject / Tag
                    </label>
                    <select
                      value={newTaskTag}
                      onChange={(e) => setNewTaskTag(e.target.value)}
                      className="w-full bg-[#111722] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                    >
                      <option value="DBMS">DBMS</option>
                      <option value="Operating Systems">Operating Systems</option>
                      <option value="Computer Networks">Computer Networks</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="General Review">General Review</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Duration (Mins)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={180}
                      step={5}
                      value={newTaskTime}
                      onChange={(e) => setNewTaskTime(Number(e.target.value))}
                      className="w-full bg-[#111722] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Priority
                    </label>
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as any)}
                      className="w-full bg-[#111722] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                    >
                      <option value="HIGH">High Priority</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Target Due Date
                    </label>
                    <input
                      type="text"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      placeholder="Today / Tomorrow"
                      className="w-full bg-[#111722] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddTaskModal(false)}
                    className="px-3.5 py-2 rounded-xl text-xs text-muted-foreground hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-md shadow-primary/20 transition-all"
                  >
                    Save Task
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
