'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Search,
  BookOpen,
  Sparkles,
  CheckCircle2,
  XCircle,
  Award,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

interface Topic {
  id: string;
  name: string;
  mastery: number;
  previous: number;
  analogy?: string;
  quiz?: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

interface Subject {
  id: string;
  name: string;
  topics: Topic[];
}

const initialSubjects: Subject[] = [
  {
    id: 'DBMS',
    name: 'Database Management Systems',
    topics: [
      {
        id: 'norm',
        name: 'Normalization (3NF & BCNF)',
        mastery: 42,
        previous: 61,
        analogy:
          'Think of Normalization like packing luggage into labeled compartments. 3NF ensures every item belongs to the suitcase owner. BCNF is stricter: every packing rule must strictly reference the passport holder (Superkey), leaving zero ambiguous labels.',
        quiz: {
          question:
            'Which condition must hold for every non-trivial functional dependency X → Y in Boyce-Codd Normal Form (BCNF)?',
          options: [
            'Y must be a prime attribute',
            'X must be a superkey of the relation',
            'The relation must have no composite candidate keys',
            'Y must not depend transitively on any non-prime attribute',
          ],
          correctIndex: 1,
          explanation:
            'In BCNF, for every functional dependency X → Y, X must be a superkey. Unlike 3NF, BCNF does not permit Y to be a prime attribute if X is not a superkey.',
        },
      },
      {
        id: 'trans',
        name: 'Transactions & ACID',
        mastery: 68,
        previous: 72,
        analogy:
          'Like an ATM withdrawal: Either the cash dispenses AND your balance is deducted (Atomicity), or nothing changes at all.',
        quiz: {
          question: 'Which ACID property ensures that concurrent transactions execute without interfering with one another?',
          options: ['Atomicity', 'Consistency', 'Isolation', 'Durability'],
          correctIndex: 2,
          explanation: 'Isolation guarantees that intermediate states of concurrent transactions remain invisible to each other.',
        },
      },
      {
        id: 'sql',
        name: 'SQL Complex Joins',
        mastery: 84,
        previous: 80,
        analogy: 'Combining two spreadsheets based on a shared column like Student ID.',
      },
    ],
  },
  {
    id: 'OS',
    name: 'Operating Systems',
    topics: [
      {
        id: 'deadlock',
        name: 'Deadlocks & Bankers Algo',
        mastery: 51,
        previous: 58,
        analogy:
          'A four-way traffic gridlock where each car is waiting for the car in front of it to move before it can proceed.',
        quiz: {
          question: "In Banker's Algorithm, a system is in a 'Safe State' if and only if:",
          options: [
            'No process currently holds locks on critical shared resources',
            'Total allocated resources equal total maximum demands',
            'There exists at least one sequence of process completions that avoids deadlock',
            'All processes release their resources simultaneously within a fixed quantum',
          ],
          correctIndex: 2,
          explanation:
            'A safe state implies that there exists at least one dispatch sequence <P1, P2, ... Pn> such that every process can satisfy its maximum resource needs and finish.',
        },
      },
      {
        id: 'memory',
        name: 'Memory Paging & Virtual Mem',
        mastery: 79,
        previous: 74,
        analogy:
          'Virtual memory is like keeping your currently used study books on your small desk while keeping the rest on the bookshelf.',
      },
    ],
  },
  {
    id: 'CN',
    name: 'Computer Networks',
    topics: [
      {
        id: 'routing',
        name: 'BGP & OSPF Routing',
        mastery: 63,
        previous: 67,
        analogy:
          'OSPF is like finding the fastest route inside your city (Link State Dijkstra), while BGP is like international flight routing between sovereign nations.',
        quiz: {
          question: 'Which routing protocol is an Interior Gateway Protocol (IGP) based on Dijkstra’s Shortest Path First algorithm?',
          options: ['BGP', 'OSPF', 'RIP', 'EGP'],
          correctIndex: 1,
          explanation:
            'OSPF (Open Shortest Path First) builds a full network topology graph and runs Dijkstra’s algorithm within an autonomous system.',
        },
      },
      {
        id: 'tcp',
        name: 'TCP 3-Way Handshake',
        mastery: 88,
        previous: 82,
        analogy: 'SYN: "Can you hear me?" SYN-ACK: "Yes I hear you, can you hear me?" ACK: "Yes, lets talk!"',
      },
    ],
  },
];

export function KnowledgeGaps() {
  const store = useAppStore();
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>(['DBMS']);
  const [selectedTopic, setSelectedTopic] = useState<{ subjectId: string; topic: Topic } | null>(null);
  const [filterTier, setFilterTier] = useState<'ALL' | 'CRITICAL' | 'ATTENTION' | 'MASTERED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'DEFAULT' | 'LOWEST' | 'DROP'>('DEFAULT');

  // Quiz state for selected topic
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [quizFeedbackToast, setQuizFeedbackToast] = useState<string | null>(null);

  const toggleSubject = (id: string) => {
    setExpandedSubjects((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleToggleAll = () => {
    if (expandedSubjects.length === subjects.length) {
      setExpandedSubjects([]);
    } else {
      setExpandedSubjects(subjects.map((s) => s.id));
    }
  };

  const handleTopicClick = (subjectId: string, topic: Topic) => {
    setSelectedTopic({ subjectId, topic });
    setSelectedQuizAnswer(null);
    setIsAnswerSubmitted(false);
  };

  const handleQuizSubmit = () => {
    if (!selectedTopic || !selectedTopic.topic.quiz || selectedQuizAnswer === null) return;
    setIsAnswerSubmitted(true);
    const isCorrect = selectedQuizAnswer === selectedTopic.topic.quiz.correctIndex;

    if (isCorrect) {
      const boost = 8;
      setSubjects((prev) =>
        prev.map((subj) =>
          subj.id === selectedTopic.subjectId
            ? {
                ...subj,
                topics: subj.topics.map((t) =>
                  t.id === selectedTopic.topic.id
                    ? { ...t, mastery: Math.min(100, t.mastery + boost) }
                    : t
                ),
              }
            : subj
        )
      );

      store.updateHealth(2);
      setQuizFeedbackToast(`Correct! +${boost}% Topic Mastery & +2 Digital Twin Health awarded!`);
    } else {
      setQuizFeedbackToast('Incorrect. Review the explanation and try again.');
    }
  };

  const handleManualBoost = (subjectId: string, topicId: string, delta: number) => {
    setSubjects((prev) =>
      prev.map((subj) =>
        subj.id === subjectId
          ? {
              ...subj,
              topics: subj.topics.map((t) =>
                t.id === topicId
                  ? { ...t, mastery: Math.min(100, t.mastery + delta) }
                  : t
              ),
            }
          : subj
      )
    );
    store.updateHealth(1);
    setQuizFeedbackToast(`Logged practice session (+${delta}% mastery)`);
  };

  const filterTopic = (topic: Topic) => {
    if (searchQuery.trim() && !topic.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterTier === 'CRITICAL') return topic.mastery < 50;
    if (filterTier === 'ATTENTION') return topic.mastery >= 50 && topic.mastery < 70;
    if (filterTier === 'MASTERED') return topic.mastery >= 70;
    return true;
  };

  const processedSubjects = subjects
    .map((subj) => {
      let filteredTopics = subj.topics.filter(filterTopic);

      if (sortBy === 'LOWEST') {
        filteredTopics = [...filteredTopics].sort((a, b) => a.mastery - b.mastery);
      } else if (sortBy === 'DROP') {
        filteredTopics = [...filteredTopics].sort(
          (a, b) => a.mastery - a.previous - (b.mastery - b.previous)
        );
      }

      return {
        ...subj,
        topics: filteredTopics,
      };
    })
    .filter((subj) => subj.topics.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#111722] border border-white/5 p-6 relative"
    >
      {/* Quiz Toast Notification */}
      <AnimatePresence>
        {quizFeedbackToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-3 right-6 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold shadow-lg"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            <span>{quizFeedbackToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-white">Knowledge Gaps</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium">
              Vector Breakdown
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Concept mastery vector breakdown — click any topic to practice &amp; remediate
          </p>
        </div>

        {/* Legend / Status Badges */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400" /> Critical (&lt;50%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Attention (50-70%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Mastered (≥70%)
          </span>
        </div>
      </div>

      {/* Search, Filter Pills & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
        {/* Tier filter */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/[0.03] border border-white/5 overflow-x-auto text-[11px]">
          {(['ALL', 'CRITICAL', 'ATTENTION', 'MASTERED'] as const).map((tier) => (
            <button
              key={tier}
              onClick={() => setFilterTier(tier)}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap',
                filterTier === tier
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-white'
              )}
            >
              {tier}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search concepts across subjects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.02] border border-white/5 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
          />
        </div>

        {/* Expand / Collapse All Button */}
        <button
          onClick={handleToggleAll}
          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 font-medium transition-colors border border-white/5 whitespace-nowrap"
        >
          {expandedSubjects.length === subjects.length ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {/* Subject Accordions */}
      <div className="space-y-3">
        {processedSubjects.map((subject) => {
          const isExpanded = expandedSubjects.includes(subject.id);
          const avgMastery = Math.round(
            subject.topics.reduce((acc, t) => acc + t.mastery, 0) / subject.topics.length
          );

          return (
            <div
              key={subject.id}
              className="border border-white/5 rounded-xl overflow-hidden bg-white/[0.02] transition-colors"
            >
              <button
                onClick={() => toggleSubject(subject.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-200">{subject.name}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground">
                    Avg: {avgMastery}%
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {subject.topics.length} {subject.topics.length === 1 ? 'topic' : 'topics'}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="p-3 pt-0 space-y-3">
                  {subject.topics.map((topic) => {
                    const delta = topic.mastery - topic.previous;
                    const isCritical = topic.mastery < 50;
                    const isAttention = topic.mastery >= 50 && topic.mastery < 70;

                    return (
                      <div
                        key={topic.id}
                        onClick={() => handleTopicClick(subject.id, topic)}
                        className="pt-2 border-t border-white/5 cursor-pointer hover:bg-white/[0.03] -mx-2 px-2 py-2 rounded-lg transition-all group"
                        title="Click to launch interactive micro-practice and concept explainer"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-200 group-hover:text-primary transition-colors">
                              {topic.name}
                            </span>
                            {topic.quiz && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 flex items-center gap-0.5">
                                <Zap className="w-2.5 h-2.5" /> Practice
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'text-xs font-bold',
                                isCritical ? 'text-red-400' : isAttention ? 'text-amber-400' : 'text-emerald-400'
                              )}
                            >
                              {topic.mastery}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${topic.mastery}%`,
                              background: isCritical ? '#EF4444' : isAttention ? '#F59E0B' : '#10B981',
                            }}
                          />
                        </div>

                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Previous assessment: {topic.previous}%</span>
                          <span className={cn('font-medium', delta >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                            {delta >= 0 ? '↑ +' : '↓ '}
                            {delta}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {processedSubjects.length === 0 && (
          <div className="text-center py-8 border border-dashed border-white/5 rounded-xl">
            <p className="text-xs text-muted-foreground">No knowledge gaps found for the active filter.</p>
          </div>
        )}
      </div>

      {/* Interactive Micro-Practice & Diagnostic Modal */}
      <AnimatePresence>
        {selectedTopic && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#111722] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <div>
                    <h4 className="text-sm font-semibold text-white">{selectedTopic.topic.name}</h4>
                    <span className="text-[11px] text-muted-foreground">
                      Current Mastery: <strong className="text-cyan-400">{selectedTopic.topic.mastery}%</strong>
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTopic(null)}
                  className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              {/* Intuitive Everyday Analogy */}
              {selectedTopic.topic.analogy && (
                <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-primary font-semibold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Intuitive Mental Model</span>
                  </div>
                  <p className="text-slate-200 leading-relaxed">{selectedTopic.topic.analogy}</p>
                </div>
              )}

              {/* Interactive Micro-Quiz */}
              {selectedTopic.topic.quiz ? (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-white flex items-center justify-between">
                    <span>Micro-Diagnostic Challenge</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20 font-normal">
                      Earn +8% Mastery
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 font-medium leading-relaxed bg-white/[0.03] p-3 rounded-lg border border-white/5">
                    {selectedTopic.topic.quiz.question}
                  </p>

                  <div className="space-y-2">
                    {selectedTopic.topic.quiz.options.map((option, idx) => {
                      const isSelected = selectedQuizAnswer === idx;
                      const isCorrect = isAnswerSubmitted && idx === selectedTopic.topic.quiz?.correctIndex;
                      const isWrong = isAnswerSubmitted && isSelected && !isCorrect;

                      return (
                        <button
                          key={idx}
                          disabled={isAnswerSubmitted}
                          onClick={() => setSelectedQuizAnswer(idx)}
                          className={cn(
                            'w-full text-left p-3 rounded-xl border text-xs transition-all flex items-start gap-2.5',
                            isCorrect
                              ? 'bg-emerald-400/20 border-emerald-400/40 text-emerald-300'
                              : isWrong
                              ? 'bg-red-400/20 border-red-400/40 text-red-300'
                              : isSelected
                              ? 'bg-primary/20 border-primary/40 text-white'
                              : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                          )}
                        >
                          <span className="font-semibold shrink-0 text-muted-foreground">{String.fromCharCode(65 + idx)}.</span>
                          <span className="flex-1">{option}</span>
                          {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                          {isWrong && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Submit / Results */}
                  {!isAnswerSubmitted ? (
                    <button
                      onClick={handleQuizSubmit}
                      disabled={selectedQuizAnswer === null}
                      className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-xs transition-colors disabled:opacity-40"
                    >
                      Verify Answer &amp; Update Digital Twin
                    </button>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-900 border border-white/10 text-xs space-y-1.5">
                      <div className="font-semibold text-white">Diagnostic Rationale:</div>
                      <p className="text-muted-foreground leading-relaxed">
                        {selectedTopic.topic.quiz.explanation}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-muted-foreground border border-white/5 rounded-xl">
                  Full practice exercises for this concept are available in your weekly assignments.
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <button
                  onClick={() => handleManualBoost(selectedTopic.subjectId, selectedTopic.topic.id, 5)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-slate-200 font-medium transition-colors flex items-center gap-1.5"
                >
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>Log 30m Study Session (+5%)</span>
                </button>

                <button
                  onClick={() => setSelectedTopic(null)}
                  className="text-xs text-muted-foreground hover:text-white"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

