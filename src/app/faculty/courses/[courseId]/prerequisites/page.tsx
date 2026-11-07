 'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type Syllabus = { id: string; originalFileName: string; student: { fullName: string; rollNumber: string } };
type Topic = { id: string; name: string; prerequisiteIds: string[]; moduleName: string };
type Proposal = { id: string; targetTopicId: string; requiredTopicId: string; status: string; explanation: string; confidence: number | null; source: string };

export default function PrerequisiteReviewPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [selected, setSelected] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async (syllabusId: string) => {
    const endpoint = `/api/faculty/courses/${courseId}/prerequisites${syllabusId ? `?syllabusId=${encodeURIComponent(syllabusId)}` : ''}`;
    const res = await fetch(endpoint);
    const data = await res.json();
    if (!res.ok) throw Error(data.error || 'Unable to load prerequisites.');
    setSyllabi(data.syllabi ?? []);
    setTopics(data.topics ?? []);
    setProposals(data.proposals ?? []);
  }, [courseId]);
  useEffect(() => { load(selected).catch(e => setError(String(e.message))); }, [load, selected]);
  const act = async (method: 'POST' | 'PATCH', body: unknown) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await fetch(`/api/faculty/courses/${courseId}/prerequisites`, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw Error(json.error || 'Request failed');
      setNotice(method === 'POST'
        ? `${json.created} new pending proposals (${json.explicitCreated ?? 0} source-backed, ${json.aiCreated ?? 0} AI-inferred). Review them below.`
        : `Decision saved: ${json.status}.`);
      await load(selected);
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
    finally { setBusy(false); }
  };
  const names = new Map(topics.map(t => [t.id, t.name]));
  return <main className="max-w-5xl mx-auto space-y-5">
    <Link className="underline text-sm" href={`/faculty/courses/${courseId}`}>← Course</Link>
    <h1 className="text-3xl font-semibold">Hybrid prerequisite review</h1>
    <p className="text-sm text-ink-2">Previously confirmed prerequisites remain enforced. PDF evidence-backed statements (EXPLICIT_TEXT) and Groq-inferred suggestions (GROQ_INFERRED) are stored as pending proposals. Only faculty approval adds newly discovered enforced links. Generated quizzes do not unlock practice tiers.</p>
    <label className="block text-sm font-medium" htmlFor="prereq-syllabus">Student syllabus</label>
    <select id="prereq-syllabus" className="p-2 border rounded w-full bg-paper-0" value={selected} onChange={e => setSelected(e.target.value)}>
      <option value="">Select active syllabus</option>
      {syllabi.map(s => <option key={s.id} value={s.id}>{s.student.fullName} ({s.student.rollNumber}) — {s.originalFileName}</option>)}
    </select>
    {selected && <button className="rounded bg-plum text-white px-4 py-2 disabled:opacity-50" disabled={busy} onClick={() => act('POST', { syllabusId: selected })}>
      {busy ? 'Working...' : 'Discover explicit evidence + Groq suggestions'}
    </button>}
    {error && <p role="alert" className="text-burgundy">{error}</p>}
    {notice && <p role="status" className="text-olive">{notice}</p>}
    {selected && <section className="space-y-2"><h2 className="text-lg font-semibold">Recorded prerequisites (already enforced)</h2>
      {topics.filter(t => t.prerequisiteIds.length).length === 0 && <p className="text-sm">No confirmed prerequisites recorded.</p>}
      {topics.filter(t => t.prerequisiteIds.length).map(t => <p key={t.id} className="text-sm border rounded p-2">{t.name} requires {t.prerequisiteIds.map(id => names.get(id) ?? 'Unknown prerequisite').join(', ')}</p>)}
    </section>}
    {selected && <section className="space-y-3"><h2 className="text-lg font-semibold">AI suggestions and faculty decisions</h2>
      {proposals.length === 0 && <p className="text-sm">No proposals yet. Discover source-backed statements and Groq suggestions. Older syllabi may need reuploading for full PDF evidence extraction.</p>}
      {proposals.map(p => <article key={p.id} className="border rounded p-4 space-y-2 bg-paper-0">
        <p className="font-semibold">{names.get(p.targetTopicId) ?? 'Missing topic'} ← requires {names.get(p.requiredTopicId) ?? 'Missing topic'}</p>
        <p className="text-sm">{p.explanation}</p>
        <p className="text-xs text-ink-2">{p.source === 'EXPLICIT_TEXT' ? 'Explicit PDF evidence' : 'Groq conceptual suggestion'} · {p.status}{p.confidence === null ? '' : ` · Suggested confidence ${Math.round(p.confidence * 100)}% (unverified)`}</p>
        {p.status === 'PENDING' && <div className="flex gap-2">
          <button disabled={busy} className="px-3 py-1.5 rounded bg-olive text-white disabled:opacity-50" onClick={() => act('PATCH', { proposalId: p.id, decision: 'APPROVED' })}>Approve</button>
          <button disabled={busy} className="px-3 py-1.5 rounded border disabled:opacity-50" onClick={() => act('PATCH', { proposalId: p.id, decision: 'REJECTED' })}>Reject</button>
        </div>}
      </article>)}
    </section>}
  </main>;
}
