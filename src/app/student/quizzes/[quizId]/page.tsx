'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, Send, XCircle } from 'lucide-react';
import { BackLink, Button, Loading, NoticeBox, Panel, errorNotice, inputClass, type Notice } from '@/components/twin/ui';

interface Question { id: string; type: 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER'; concept: string; prompt: string; choices: string[] }
interface Quiz { id: string; title: string; description: string | null; durationMins: number; attempts: number; course: { code: string; name: string }; questions: Question[];
  available: boolean; message?: string; startToken?: string; endsAt?: string; maxAttempts: number | null; attemptsLeft: number | null }
interface Result { score: number; total: number; percentage: number; results: Array<{ questionId: string; isCorrect: boolean; correctAnswer: string }>; twinUpdatesQueued: number }

export default function TakeQuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const autoSubmitted = useRef(false);

  useEffect(() => {
    fetch(`/api/student/quizzes/${quizId}`).then(async (res) => {
      if (!res.ok) { setNotice(await errorNotice(res)); return; }
      setQuiz((await res.json()).quiz);
    });
  }, [quizId]);

  const submit = useCallback(async (auto = false) => {
    if (!quiz) return;
    const unanswered = quiz.questions.filter((q) => !answers[q.id]?.trim()).length;
    if (!auto && unanswered && !confirm(`${unanswered} question(s) are unanswered and will be marked wrong. Submit anyway?`)) return;
    setBusy(true); setNotice(null);
    const res = await fetch(`/api/student/quizzes/${quizId}/attempts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers, startToken: quiz.startToken }) });
    setBusy(false);
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    setResult(await res.json());
    if (auto) setNotice({ kind: 'ok', text: 'Time was up, so your answers were submitted automatically.' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [quiz, answers, quizId]);

  // Countdown; submits automatically when time runs out (the server also refuses late attempts).
  useEffect(() => {
    if (!quiz?.available || !quiz.endsAt || result) return;
    const end = new Date(quiz.endsAt).getTime();
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      setRemaining(left);
      if (left === 0 && !autoSubmitted.current) { autoSubmitted.current = true; submit(true); }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [quiz, result, submit]);

  const clock = remaining === null ? '' : `${Math.floor(remaining / 60000)}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}`;

  const outcome = (id: string) => result?.results.find((r) => r.questionId === id);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <BackLink href="/student/quizzes" label="Back to quizzes" />
      <NoticeBox notice={notice} />
      {!quiz ? (!notice && <Loading label="Loading quiz..." />) : (
        <>
          <div className="space-y-1">
            <span className="font-mono text-xs text-ink-3">{quiz.course.code} · {quiz.available ? `${quiz.questions.length} questions · ` : ''}{quiz.durationMins} min{quiz.attempts ? ` · ${quiz.attempts} earlier attempt(s)` : ''}{quiz.attemptsLeft !== null ? ` · ${quiz.attemptsLeft} attempt(s) left` : ''}</span>
            {quiz.available && !result && remaining !== null && (
              <div role="timer" aria-live="polite" className={`inline-block ml-2 px-2 py-0.5 rounded font-mono text-xs ${remaining < 60_000 ? 'bg-burgundy text-paper-0' : 'bg-paper-1 border border-paper-3 text-ink-0'}`}>Time left {clock}</div>
            )}
            {!quiz.available && <p className="mt-2 text-sm text-burgundy">{quiz.message}</p>}
            <h1 className="font-baskerville italic text-3xl text-ink-0">{quiz.title}</h1>
            {quiz.description && <p className="text-xs text-ink-2">{quiz.description}</p>}
          </div>

          {result && (
            <Panel>
              <p className="font-space text-2xl font-bold text-ink-0">{result.score}/{result.total} · {result.percentage}%</p>
              <p className="text-xs text-ink-2">Your concept mastery has been updated{result.twinUpdatesQueued ? ', and your digital twin is updating now; your dashboard will show it in a few seconds' : ''}.</p>
            </Panel>
          )}

          {quiz.questions.length === 0 ? <p className="text-xs text-ink-2">This quiz has no questions yet.</p> : quiz.questions.map((q, i) => {
            const o = outcome(q.id);
            return (
              <Panel key={q.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-ink-0"><span className="font-mono text-ink-3 mr-2">{i + 1}.</span>{q.prompt}</p>
                  {o && (o.isCorrect ? <CheckCircle2 className="w-5 h-5 text-olive shrink-0" /> : <XCircle className="w-5 h-5 text-burgundy shrink-0" />)}
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">{q.concept}</span>
                {q.choices.length ? (
                  <div className="space-y-1.5">
                    {q.choices.map((c) => (
                      <label key={c} className={`flex items-center gap-2 text-xs p-2 rounded border ${answers[q.id] === c ? 'border-plum bg-plum-light' : 'border-paper-3'}`}>
                        <input type="radio" name={q.id} disabled={!!result} checked={answers[q.id] === c} onChange={() => setAnswers({ ...answers, [q.id]: c })} />{c}
                      </label>
                    ))}
                  </div>
                ) : (
                  <input aria-label="Your answer" className={inputClass} disabled={!!result} placeholder="Your answer" value={answers[q.id] ?? ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                )}
                {o && !o.isCorrect && <p className="text-xs text-ink-2">Correct answer: <b className="text-ink-0">{o.correctAnswer}</b></p>}
              </Panel>
            );
          })}

          {!result && quiz.questions.length > 0 && <Button onClick={() => submit()} disabled={busy}><Send className="w-3.5 h-3.5" />Submit answers</Button>}
          {result && <Button variant="ghost" onClick={() => { setResult(null); setAnswers({}); }}>Try again</Button>}
        </>
      )}
    </div>
  );
}
