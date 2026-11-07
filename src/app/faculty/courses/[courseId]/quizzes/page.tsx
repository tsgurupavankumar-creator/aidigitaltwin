'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Save, Trash2 } from 'lucide-react';
import { BackLink, Button, Loading, NoticeBox, Panel, errorNotice, inputClass, labelClass, type Notice } from '@/components/twin/ui';

type QType = 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER';
interface Concept { id: string; name: string }
interface QuizRow { id: string; title: string; durationMins: number; questions: number; attempts: number; maxAttempts: number | null; opensAt: string | null; closesAt: string | null; isClosed: boolean }
interface Draft { prompt: string; type: QType; choices: string[]; correctAnswer: string; conceptId: string; difficulty: number }

const blank = (conceptId = ''): Draft => ({ prompt: '', type: 'MCQ', choices: ['', '', '', ''], correctAnswer: '', conceptId, difficulty: 3 });

export default function QuizzesPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [quizzes, setQuizzes] = useState<QuizRow[] | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('15');
  const [questions, setQuestions] = useState<Draft[]>([blank()]);
  const [maxAttempts, setMaxAttempts] = useState('');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [editing, setEditing] = useState<{ id: string; locked: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    const [q, c] = await Promise.all([fetch(`/api/faculty/courses/${courseId}/quizzes`), fetch(`/api/faculty/courses/${courseId}/concepts`)]);
    if (!q.ok) { setNotice(await errorNotice(q)); setQuizzes([]); return; }
    setQuizzes((await q.json()).quizzes);
    if (c.ok) {
      const list: Concept[] = (await c.json()).concepts;
      setConcepts(list);
      setQuestions((qs) => qs.map((x) => (x.conceptId ? x : { ...x, conceptId: list[0]?.id ?? '' })));
    }
  }, [courseId]);
  useEffect(() => { load(); }, [load]);

  const update = (i: number, patch: Partial<Draft>) => setQuestions(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  function reset() {
    setEditing(null); setTitle(''); setDuration('15'); setMaxAttempts(''); setOpensAt(''); setClosesAt('');
    setQuestions([blank(concepts[0]?.id ?? '')]);
  }

  async function create() {
    setBusy(true); setNotice(null);
    const settings = { maxAttempts: maxAttempts ? Number(maxAttempts) : null, opensAt: opensAt || null, closesAt: closesAt || null };
    const qs = questions.map((q) => ({ ...q, choices: q.type === 'MCQ' ? q.choices.map((c) => c.trim()).filter(Boolean) : [] }));
    const payload = { title, durationMins: Number(duration), ...settings, ...(editing?.locked ? {} : { questions: qs }) };
    const res = await fetch(editing ? `/api/faculty/courses/${courseId}/quizzes/${editing.id}` : `/api/faculty/courses/${courseId}/quizzes`,
      { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    setNotice({ kind: 'ok', text: editing ? 'Quiz saved.' : 'Quiz published. Enrolled students can take it when it is open; each attempt updates their mastery and twin.' });
    reset();
    await load();
  }

  async function edit(id: string) {
    setNotice(null);
    const res = await fetch(`/api/faculty/courses/${courseId}/quizzes/${id}`);
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    const { quiz } = await res.json();
    setEditing({ id, locked: quiz.questionsLocked });
    setTitle(quiz.title); setDuration(String(quiz.durationMins)); setMaxAttempts(quiz.maxAttempts ? String(quiz.maxAttempts) : '');
    setOpensAt(quiz.opensAt); setClosesAt(quiz.closesAt);
    setQuestions(quiz.questions.map((q: Draft & { choices: string[] }) => ({ prompt: q.prompt, type: q.type, conceptId: q.conceptId, difficulty: q.difficulty, correctAnswer: q.correctAnswer,
      choices: q.type === 'MCQ' ? [...q.choices, '', '', '', ''].slice(0, Math.max(4, q.choices.length)) : ['', '', '', ''] })));
    if (quiz.questionsLocked) setNotice({ kind: 'ok', text: `${quiz.attempts} attempt(s) exist, so the questions are locked; you can still change the settings or close the quiz.` });
  }

  async function setClosed(q: QuizRow, isClosed: boolean) {
    const res = await fetch(`/api/faculty/courses/${courseId}/quizzes/${q.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isClosed }) });
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    setNotice({ kind: 'ok', text: isClosed ? `Closed "${q.title}".` : `Reopened "${q.title}".` });
    await load();
  }

  async function remove(q: QuizRow) {
    if (!confirm(`Delete "${q.title}"?`)) return;
    const res = await fetch(`/api/faculty/courses/${courseId}/quizzes/${q.id}`, { method: 'DELETE' });
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    setNotice({ kind: 'ok', text: `Deleted "${q.title}".` });
    await load();
  }

  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <BackLink href={`/faculty/courses/${courseId}`} label="Back to course" />
      <h1 className="font-baskerville italic text-3xl text-ink-0">Quizzes</h1>
      <NoticeBox notice={notice} />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Panel title={editing ? 'Edit quiz' : 'New quiz'} actions={<div className="flex gap-2">{editing && <Button variant="ghost" onClick={reset}>Cancel</Button>}<Button onClick={create} disabled={busy || !title.trim() || !concepts.length}><Save className="w-3.5 h-3.5" />{editing ? 'Save' : 'Publish'}</Button></div>}>
          {!concepts.length && <p className="text-xs text-burgundy">This course has no concepts yet; every question must be linked to a concept. <a className="underline" href={`/faculty/courses/${courseId}/concepts`}>Add concepts</a> first.</p>}
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <div><label htmlFor="qz-title" className={labelClass}>Title</label><input id="qz-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><label htmlFor="qz-min" className={labelClass}>Time limit (min)</label><input id="qz-min" type="number" min="1" className={inputClass} value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div><label htmlFor="qz-att" className={labelClass}>Max attempts (blank = unlimited)</label><input id="qz-att" type="number" min="1" className={inputClass} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} /></div>
            <div><label htmlFor="qz-open" className={labelClass}>Opens (optional)</label><input id="qz-open" type="datetime-local" className={inputClass} value={opensAt} onChange={(e) => setOpensAt(e.target.value)} /></div>
            <div><label htmlFor="qz-close" className={labelClass}>Closes (optional)</label><input id="qz-close" type="datetime-local" className={inputClass} value={closesAt} onChange={(e) => setClosesAt(e.target.value)} /></div>
          </div>
          {editing?.locked && <p className="text-xs text-ink-2">Questions are locked because students have attempted this quiz.</p>}
          {!editing?.locked && questions.map((q, i) => (
            <div key={i} className="p-4 rounded border border-paper-3 bg-paper-1 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">Question {i + 1}</span>
                {questions.length > 1 && <button onClick={() => setQuestions(questions.filter((_, j) => j !== i))} className="text-ink-3 hover:text-burgundy"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
              <textarea aria-label="What is being asked?" className={inputClass} rows={2} placeholder="What is being asked?" value={q.prompt} onChange={(e) => update(i, { prompt: e.target.value })} />
              <div className="grid grid-cols-3 gap-2">
                <select aria-label={`Question ${i + 1} type`} className={inputClass} value={q.type} onChange={(e) => update(i, { type: e.target.value as QType, correctAnswer: '' })}>
                  <option value="MCQ">Multiple choice</option><option value="TRUE_FALSE">True / false</option><option value="SHORT_ANSWER">Short answer</option>
                </select>
                <select aria-label={`Question ${i + 1} concept`} className={inputClass} value={q.conceptId} onChange={(e) => update(i, { conceptId: e.target.value })}>
                  {concepts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select aria-label={`Question ${i + 1} difficulty`} className={inputClass} value={q.difficulty} onChange={(e) => update(i, { difficulty: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>Difficulty {d}</option>)}
                </select>
              </div>
              {q.type === 'MCQ' && (
                <div className="grid grid-cols-2 gap-2">
                  {q.choices.map((c, k) => (
                    <label key={k} className="flex items-center gap-2">
                      <input type="radio" name={`correct-${i}`} checked={!!c && q.correctAnswer === c} onChange={() => update(i, { correctAnswer: c })} disabled={!c} />
                      <input aria-label={`Question ${i + 1}, choice ${k + 1}`} className={inputClass} placeholder={`Choice ${k + 1}`} value={c} onChange={(e) => {
                        const choices = q.choices.map((x, j) => (j === k ? e.target.value : x));
                        update(i, { choices, correctAnswer: q.correctAnswer === c ? e.target.value : q.correctAnswer });
                      }} />
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'TRUE_FALSE' && (
                <div className="flex gap-4 text-xs">{['True', 'False'].map((v) => <label key={v} className="flex items-center gap-1.5"><input type="radio" name={`tf-${i}`} checked={q.correctAnswer === v} onChange={() => update(i, { correctAnswer: v })} />{v}</label>)}</div>
              )}
              {q.type === 'SHORT_ANSWER' && (
                <input aria-label={`Question ${i + 1} correct answer`} className={inputClass} placeholder="Exact correct answer (case and spacing are ignored when grading)" value={q.correctAnswer} onChange={(e) => update(i, { correctAnswer: e.target.value })} />
              )}
            </div>
          ))}
          {!editing?.locked && <Button variant="ghost" onClick={() => setQuestions([...questions, blank(concepts[0]?.id ?? '')])}><Plus className="w-3.5 h-3.5" />Add question</Button>}
        </Panel>

        <Panel title="Published">
          {!quizzes ? <Loading /> : quizzes.length === 0 ? <p className="text-xs text-ink-2">No quizzes yet.</p> : (
            <ul className="divide-y divide-paper-3 text-xs">
              {quizzes.map((q) => (
                <li key={q.id} className="py-2 space-y-1">
                  <span className="font-semibold text-ink-0 block">{q.title}{q.isClosed && <span className="ml-2 font-mono text-[10px] text-burgundy">CLOSED</span>}</span>
                  <span className="font-mono text-ink-3 block">{q.questions} questions · {q.durationMins} min · {q.attempts} attempts{q.maxAttempts ? ` · max ${q.maxAttempts} each` : ''}</span>
                  {(q.opensAt || q.closesAt) && <span className="font-mono text-ink-3 block">{q.opensAt ? `Opens ${when(q.opensAt)}` : ''}{q.opensAt && q.closesAt ? ' · ' : ''}{q.closesAt ? `Closes ${when(q.closesAt)}` : ''}</span>}
                  <span className="flex gap-3 font-mono text-[11px]">
                    <button type="button" className="text-plum hover:underline" onClick={() => edit(q.id)}>Edit</button>
                    <button type="button" className="text-plum hover:underline" onClick={() => setClosed(q, !q.isClosed)}>{q.isClosed ? 'Reopen' : 'Close'}</button>
                    {q.attempts === 0 && <button type="button" className="text-burgundy hover:underline" onClick={() => remove(q)}>Delete</button>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
