'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
type Syllabus = { id: string; version: number; active: boolean; originalFileName: string; topicCount: number; createdAt: string; course: { name: string; code: string } };
export default function StudentCoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [error, setError] = useState('');
  const refresh = async () => { const r = await fetch(`/api/student/syllabi?courseId=${encodeURIComponent(courseId)}`); const json = await r.json(); if (!r.ok) throw new Error(json.error || 'Unable to load syllabi'); setSyllabi(json.syllabi || []); };
  useEffect(() => { refresh().catch(e => setError(e.message)); }, [courseId]);
  const activate = async (id: string) => { const r = await fetch(`/api/student/syllabus/${id}/activate`, { method: 'POST' }); if (!r.ok) { setError('Unable to activate version'); return; } refresh().catch(e => setError(e.message)); };
  return <main className="max-w-5xl mx-auto space-y-6"><Link href="/student/courses" className="text-sm underline">← All courses</Link>
    <h1 className="text-3xl font-semibold">{syllabi[0]?.course.name || 'Personal learning graph'}</h1>
    <p className="text-sm text-ink-2">Upload and review your syllabus, then practise individual topics at your own pace.</p>
    <Link href="/student/quizzes/new" className="inline-block rounded bg-terracotta text-white px-4 py-2">Upload PDF via syllabus wizard</Link>
    {error && <p role="alert" className="text-burgundy">{error}</p>}
    {!syllabi.length && <p>No syllabi have been uploaded for this course.</p>}
    <div className="grid md:grid-cols-2 gap-4">{syllabi.map(s => <section key={s.id} className="rounded-lg bg-paper-0 border border-paper-3 p-5 space-y-3">
      <p className="text-sm font-semibold">Syllabus v{s.version} {s.active ? '· Active' : '· Historical'}</p>
      <p className="text-xs text-ink-2">{s.originalFileName} · {s.topicCount} topics</p>
      <Link href={`/student/syllabus/${s.id}`} className="inline-block underline text-terracotta text-sm">View learning tree</Link>
      {!s.active && <button className="ml-4 text-sm underline" onClick={() => activate(s.id)}>Activate this version</button>}
    </section>)}</div></main>;
}
