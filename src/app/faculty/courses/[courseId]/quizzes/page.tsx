'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Save, Trash2 } from 'lucide-react';
import { BackLink, Button, Loading, NoticeBox, Panel, errorNotice, inputClass, labelClass, type Notice } from '@/components/twin/ui';

type QType = 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER';
interface Concept { id: string; name: string }
interface QuizRow { id: string; title: string; durationMins: number; questions: number; attempts: number }
interface Draft { prompt: string; type: QType; choices: string[]; correctAnswer: string; conceptId: string; difficulty: number }

const blank = (conceptId = ''): Draft => ({ prompt: '', type: 'MCQ', choices: ['', '', '', ''], correctAnswer: '', conceptId, difficulty: 3 });

export default function QuizzesPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [quizzes, setQuizzes] = useState<QuizRow[] | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('15');
  const [questions, setQuestions] = useState<Draft[]>([blank()]);
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

  async function create() {
    setBusy(true); setNotice(null);
    const payload = {
      title, durationMins: Number(duration),
      questions: questions.map((q) => ({ ...q, choices: q.type === 'MCQ' ? q.choices.map((c) => c.trim()).filter(Boolean) : [] })),
    };
    const res = await fetch(`/api/faculty/courses/${courseId}/quizzes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    setNotice({ kind: 'ok', text: 'Quiz published. Enrolled students can take it now; each attempt updates their mastery and twin.' });
    setTitle(''); setQuestions([blank(concepts[0]?.id ?? '')]);
    await load();
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <BackLink href={`/faculty/courses/${courseId}`} label="Back to course" />
      <h1 className="font-baskerville italic text-3xl text-ink-0">Quizzes</h1>
      <NoticeBox notice={notice} />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Panel title="New quiz" actions={<Button onClick={create} disabled={busy || !title.trim() || !concepts.length}><Save className="w-3.5 h-3.5" />Publish</Button>}>
          {!concepts.length && <p className="text-xs text-burgundy">This course has no concepts yet; every question must be linked to a concept.</p>}
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <div><label className={labelClass}>Title</label><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><label className={labelClass}>Minutes</label><input type="number" min="1" className={inputClass} value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
          </div>
          {questions.map((q, i) => (
            <div key={i} className="p-4 rounded border border-paper-3 bg-paper-1 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">Question {i + 1}</span>
                {questions.length > 1 && <button onClick={() => setQuestions(questions.filter((_, j) => j !== i))} className="text-ink-3 hover:text-burgundy"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
              <textarea className={inputClass} rows={2} placeholder="What is being asked?" value={q.prompt} onChange={(e) => update(i, { prompt: e.target.value })} />
              <div className="grid grid-cols-3 gap-2">
                <select className={inputClass} value={q.type} onChange={(e) => update(i, { type: e.target.value as QType, correctAnswer: '' })}>
                  <option value="MCQ">Multiple choice</option><option value="TRUE_FALSE">True / false</option><option value="SHORT_ANSWER">Short answer</option>
                </select>
                <select className={inputClass} value={q.conceptId} onChange={(e) => update(i, { conceptId: e.target.value })}>
                  {concepts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className={inputClass} value={q.difficulty} onChange={(e) => update(i, { difficulty: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>Difficulty {d}</option>)}
                </select>
              </div>
              {q.type === 'MCQ' && (
                <div className="grid grid-cols-2 gap-2">
                  {q.choices.map((c, k) => (
                    <label key={k} className="flex items-center gap-2">
                      <input type="radio" name={`correct-${i}`} checked={!!c && q.correctAnswer === c} onChange={() => update(i, { correctAnswer: c })} disabled={!c} />
                      <input className={inputClass} placeholder={`Choice ${k + 1}`} value={c} onChange={(e) => {
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
                <input className={inputClass} placeholder="Exact correct answer (case and spacing are ignored when grading)" value={q.correctAnswer} onChange={(e) => update(i, { correctAnswer: e.target.value })} />
              )}
            </div>
          ))}
          <Button variant="ghost" onClick={() => setQuestions([...questions, blank(concepts[0]?.id ?? '')])}><Plus className="w-3.5 h-3.5" />Add question</Button>
        </Panel>

        <Panel title="Published">
          {!quizzes ? <Loading /> : quizzes.length === 0 ? <p className="text-xs text-ink-2">No quizzes yet.</p> : (
            <ul className="divide-y divide-paper-3 text-xs">
              {quizzes.map((q) => <li key={q.id} className="py-2"><span className="font-semibold text-ink-0 block">{q.title}</span><span className="font-mono text-ink-3">{q.questions} questions · {q.durationMins} min · {q.attempts} attempts</span></li>)}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
