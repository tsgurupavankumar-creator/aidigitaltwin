'use client';

import { motion } from 'framer-motion';
import { HelpCircle, Brain, CheckCircle2, Clock, Sparkles, Play } from 'lucide-react';

const MOCK_QUIZZES = [
  {
    id: 'quiz-1',
    title: 'DBMS Normalization & BCNF Vector Drill',
    subject: 'Database Management Systems',
    questions: 10,
    duration: '15 mins',
    difficulty: 'Hard',
    score: 'Pending',
    recommendationReason: 'Targeted remediation for 42% retention score on BCNF decomposition.',
  },
  {
    id: 'quiz-2',
    title: 'Operating Systems Deadlock Prevention',
    subject: 'Operating Systems',
    questions: 8,
    duration: '12 mins',
    difficulty: 'Medium',
    score: '85%',
    recommendationReason: 'Automated diagnostic quiz dispatched by AI Agent.',
  },
  {
    id: 'quiz-3',
    title: 'Computer Networks TCP/IP Flow Control',
    subject: 'Computer Networks',
    questions: 12,
    duration: '20 mins',
    difficulty: 'Medium',
    score: '92%',
    recommendationReason: 'Mastery verification test.',
  },
];

export default function QuizzesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink-0 tracking-tight flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-terracotta" />
            AI Diagnostic Quizzes & Adaptive Drills
          </h2>
          <p className="text-xs text-ink-2">
            Remediate concept knowledge gaps identified by your digital twin vector state.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {MOCK_QUIZZES.map((quiz, i) => (
          <motion.div
            key={quiz.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="p-5 rounded-2xl bg-paper-1 border border-paper-3 hover:border-terracotta/40 transition-all space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-terracotta/10 text-terracotta border border-terracotta/20">
                  {quiz.subject}
                </span>
                <span className="text-[11px] text-ink-2 font-medium">{quiz.difficulty}</span>
              </div>

              <h3 className="font-bold text-ink-0 text-base leading-snug">{quiz.title}</h3>

              <div className="p-3 rounded-xl bg-paper-0 border border-paper-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-mustard font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Recommendation</span>
                </div>
                <p className="text-[11px] text-ink-2 leading-relaxed">{quiz.recommendationReason}</p>
              </div>

              <div className="flex items-center justify-between text-xs text-ink-2 pt-1">
                <span className="flex items-center gap-1">
                  <Brain className="w-3.5 h-3.5 text-terracotta" />
                  {quiz.questions} Questions
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-navy" />
                  {quiz.duration}
                </span>
              </div>
            </div>

            <button className="w-full py-2.5 text-xs font-semibold rounded-xl bg-terracotta hover:bg-terracotta/90 text-paper-0 shadow-md shadow-terracotta/15 flex items-center justify-center gap-2 transition-all">
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Launch Quiz Drill</span>
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
