'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, Brain, Clock, Sparkles, Play, Loader2, RotateCcw, CheckCircle2 } from 'lucide-react';

interface QuizItem {
  id: string;
  title: string;
  subject: string;
  courseCode: string;
  questions: number;
  available: boolean;
  status: string;
  duration: string;
  difficulty: string;
  score: string;
  isAIGenerated: boolean;
  recommendationReason: string;
}

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchQuizzes = async () => {
    setLoading(true);
    setError('');
    try {
      const concept = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('concept') : null;
      const res = await fetch(concept ? `/api/student/quizzes?concept=${encodeURIComponent(concept)}` : '/api/student/quizzes');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load quizzes');
      setQuizzes(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load quizzes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink-0 tracking-tight flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-terracotta" />
            AI Diagnostic Quizzes & Adaptive Drills
          </h2>
          <p className="text-xs text-ink-2">Quizzes from your courses. Each attempt updates your concept mastery and your twin.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-16 rounded-2xl bg-paper-1 border border-paper-3 flex flex-col items-center justify-center gap-3 text-ink-2">
          <Loader2 className="w-6 h-6 animate-spin text-terracotta" />
          <span className="font-mono text-xs uppercase tracking-wider">Fetching live course quizzes...</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-burgundy/10 border border-burgundy/20 space-y-3">
          <p className="text-sm font-semibold text-burgundy">{error}</p>
          <button
            onClick={fetchQuizzes}
            className="px-3 py-1.5 text-xs font-mono rounded bg-terracotta text-paper-0 hover:bg-[#B4512D] transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="p-16 rounded-2xl bg-paper-1 border border-paper-3 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-olive mx-auto" />
          <h3 className="font-semibold text-ink-0 text-sm">No Diagnostic Quizzes Available</h3>
          <p className="text-xs text-ink-2">All assigned quizzes for your enrolled courses have been completed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {quizzes.map((quiz, i) => (
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
                    {quiz.courseCode || quiz.subject}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-semibold text-ink-3">
                      Score: {quiz.score}
                    </span>
                    <span className="text-[11px] text-ink-2 font-medium">{quiz.difficulty}</span>
                  </div>
                </div>

                <h3 className="font-bold text-ink-0 text-base leading-snug">{quiz.title}</h3>

                <div className="p-3 rounded-xl bg-paper-0 border border-paper-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-mustard font-semibold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{quiz.isAIGenerated ? 'AI Adaptive Diagnostic' : 'Curriculum Assessment'}</span>
                  </div>
                  <p className="text-[11px] text-ink-2 leading-relaxed">{quiz.recommendationReason}</p>
                </div>

                <div className="flex items-center justify-between text-xs text-ink-2 pt-1">
                  <span className="flex items-center gap-1 font-mono">
                    <Brain className="w-3.5 h-3.5 text-terracotta" />
                    {quiz.questions} Questions
                  </span>
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-navy" />
                    {quiz.duration}
                  </span>
                </div>
              </div>

              <p className={`text-[11px] font-mono ${quiz.available ? 'text-ink-2' : 'text-burgundy'}`}>{quiz.status}</p>
              <Link href={`/student/quizzes/${quiz.id}`} aria-disabled={!quiz.available} className={`w-full py-2.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${quiz.available ? 'bg-terracotta hover:bg-terracotta/90 text-paper-0 shadow-md shadow-terracotta/15' : 'bg-paper-2 text-ink-3 pointer-events-none'}`}>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{quiz.available ? 'Start quiz' : 'Not available'}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
