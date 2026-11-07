'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
type Tier = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
type Topic = { id: string; name: string; description?: string; depth: number; levelTarget: Tier; parseConfidence: number | null; prerequisiteIds: string[]; estimatedMinutes: number | null; mastery: Record<Tier,number>; attemptCounts: Record<Tier, number>; generatedQuiz: { answered: number; correct: number; percentage: number; lastAt: string | null } | null };
type Module = { id: string; name: string; estimatedMinutes: number | null; actualMinutes: number; topics: Topic[] };
type Tree = { version: number; active: boolean; modules: Module[] };
const tiers: Tier[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
export default function SyllabusTreePage() {
  const { syllabusId } = useParams<{ syllabusId: string }>();
  const [tree, setTree] = useState<Tree | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { fetch(`/api/student/syllabus/${syllabusId}`).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setTree(d); }).catch(e => setError(e.message)); }, [syllabusId]);
  const edit = async (topic: Topic) => { const name = window.prompt('Correct topic name:', topic.name); if (!name?.trim() || name === topic.name) return;
    const r = await fetch(`/api/student/syllabus/${syllabusId}/edit`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topics: [{ id: topic.id, name: name.trim() }] }) });
    if (r.ok) location.reload(); else setError('Unable to edit topic'); };
  return <main className="max-w-5xl mx-auto space-y-6"><Link href="/student/courses" className="text-sm underline">← Courses</Link>
    <h1 className="text-3xl font-semibold">Your learning graph · v{tree?.version ?? '…'}</h1>
    <p className="text-sm text-ink-2">Topic progress is tracked separately at Beginner, Intermediate and Advanced levels. A tier unlocks at 70% mastery.</p>
    {error && <p role="alert" className="text-burgundy">{error}</p>}
    {!tree && !error && <p>Loading syllabus tree…</p>}
    {tree?.modules.map(module => <details open key={module.id} className="rounded-lg border border-paper-3 bg-paper-0 p-4">
      <summary className="cursor-pointer font-semibold text-lg">{module.name} <span className="text-xs font-normal"> · {module.topics.length} topics · {module.actualMinutes} min studied</span></summary>
      <div className="mt-4 space-y-3">{module.topics.map(topic => <section key={topic.id} style={{ marginLeft: Math.min(3,topic.depth)*22 }} className="rounded border border-paper-3 p-3 space-y-2">
        <div className="flex justify-between flex-wrap gap-2"><div><p className="font-semibold text-sm">{topic.name} {topic.parseConfidence !== null && topic.parseConfidence < .7 && <span title="Please review this extracted topic">⚠</span>}</p>
          <p className="text-xs text-ink-3">Suggested: {topic.levelTarget} · Estimated {topic.estimatedMinutes ?? '—'} min</p></div>
          <div className="flex gap-3"><button onClick={() => edit(topic)} className="underline text-xs">Edit</button><Link className="text-terracotta underline text-sm" href={`/student/practice/${topic.id}`}>Practice →</Link></div></div>
        <div className="grid grid-cols-3 gap-2">{tiers.map(level => <div key={level} className="text-xs"><span>{level}: {Math.round(topic.mastery[level]*100)}%</span>
          <div className="h-1.5 rounded bg-paper-3"><div style={{ width: `${topic.mastery[level]*100}%` }} className="h-full bg-terracotta rounded" /></div></div>)}</div>
        <div className="text-xs rounded bg-paper-1 border border-paper-3 px-2 py-1">
          Generated quiz (revision only): {topic.generatedQuiz ? `${topic.generatedQuiz.percentage}% · ${topic.generatedQuiz.correct}/${topic.generatedQuiz.answered} correct` : 'No generated quiz attempts'}
          <span className="block text-ink-3">Not used for tier unlocking.</span>
        </div>
        {topic.prerequisiteIds.length > 0 && <p className="text-xs text-ink-2">Requires: {topic.prerequisiteIds.map(id => tree?.modules.flatMap(m => m.topics).find(t => t.id === id)?.name || 'Related topic').join(', ')}</p>}
      </section>)}</div>
    </details>)}</main>;
}
