'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Save } from 'lucide-react';
import { BackLink, Button, Loading, NoticeBox, Panel, errorNotice, inputClass, labelClass, savedNotice, type Notice } from '@/components/twin/ui';

interface Concept { id: string; name: string }
interface AssignmentRow { id: string; title: string; maxMarks: number; dueDate: string; graded: number; submitted: number; concepts: Concept[] }
interface RosterRow { id: string; rollNumber: string; fullName: string; status: string | null; marksObtained: number | null }

export default function GradesPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [assignments, setAssignments] = useState<AssignmentRow[] | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selected, setSelected] = useState<AssignmentRow | null>(null);
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ title: '', maxMarks: '20', dueDate: new Date().toISOString().slice(0, 10), conceptIds: [] as string[] });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    const [a, c] = await Promise.all([fetch(`/api/faculty/courses/${courseId}/assignments`), fetch(`/api/faculty/courses/${courseId}/concepts`)]);
    if (!a.ok) { setNotice(await errorNotice(a)); setAssignments([]); return; }
    setAssignments((await a.json()).assignments);
    if (c.ok) setConcepts((await c.json()).concepts);
  }, [courseId]);

  const loadRoster = useCallback(async (assignmentId: string) => {
    setRoster(null);
    const res = await fetch(`/api/faculty/courses/${courseId}/assignments/${assignmentId}/grades`);
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    const body = await res.json();
    setRoster(body.students);
    setMarks(Object.fromEntries(body.students.filter((s: RosterRow) => s.marksObtained !== null).map((s: RosterRow) => [s.id, String(s.marksObtained)])));
  }, [courseId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (selected) loadRoster(selected.id); }, [selected, loadRoster]);

  async function createAssignment() {
    setBusy(true); setNotice(null);
    const res = await fetch(`/api/faculty/courses/${courseId}/assignments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: form.title, maxMarks: Number(form.maxMarks), dueDate: form.dueDate, conceptIds: form.conceptIds }),
    });
    setBusy(false);
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    setForm({ ...form, title: '', conceptIds: [] });
    setNotice({ kind: 'ok', text: 'Assignment created.' });
    await load();
  }

  async function save() {
    if (!selected) return;
    const grades = Object.entries(marks).filter(([, v]) => v.trim() !== '').map(([studentId, v]) => ({ studentId, marksObtained: Number(v) }));
    const bad = grades.find((g) => !Number.isFinite(g.marksObtained));
    if (bad) { setNotice({ kind: 'error', text: 'Marks must be numbers.' }); return; }
    if (!grades.length) { setNotice({ kind: 'error', text: 'Enter at least one mark first.' }); return; }
    setBusy(true); setNotice(null);
    const res = await fetch(`/api/faculty/courses/${courseId}/assignments/${selected.id}/grades`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grades }) });
    setBusy(false);
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    setNotice(savedNotice(await res.json(), 'grade'));
    await Promise.all([load(), loadRoster(selected.id)]);
  }

  const toggleConcept = (id: string) => setForm({ ...form, conceptIds: form.conceptIds.includes(id) ? form.conceptIds.filter((x) => x !== id) : [...form.conceptIds, id] });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <BackLink href={`/faculty/courses/${courseId}`} label="Back to course" />
      <h1 className="font-baskerville italic text-3xl text-ink-0">Assignments &amp; grades</h1>
      <NoticeBox notice={notice} />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <Panel title="New assignment">
            <div className="space-y-3">
              <div><label className={labelClass}>Title</label><input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelClass}>Max marks</label><input type="number" min="1" className={inputClass} value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: e.target.value })} /></div>
                <div><label className={labelClass}>Due date</label><input type="date" className={inputClass} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
              </div>
              <div>
                <label className={labelClass}>Concepts assessed (grades update mastery for these)</label>
                <div className="flex flex-wrap gap-1.5">
                  {concepts.length === 0 && <span className="text-[11px] text-ink-3">This course has no concepts yet.</span>}
                  {concepts.map((c) => (
                    <button key={c.id} onClick={() => toggleConcept(c.id)} className={`px-2 py-1 rounded text-[11px] border ${form.conceptIds.includes(c.id) ? 'bg-plum text-paper-0 border-plum' : 'bg-paper-0 border-paper-3 text-ink-2'}`}>{c.name}</button>
                  ))}
                </div>
              </div>
              <Button onClick={createAssignment} disabled={busy || !form.title.trim() || !(Number(form.maxMarks) > 0)}><Plus className="w-3.5 h-3.5" />Create</Button>
            </div>
          </Panel>

          <Panel title="Assignments">
            {!assignments ? <Loading /> : assignments.length === 0 ? <p className="text-xs text-ink-2">No assignments yet.</p> : (
              <ul className="divide-y divide-paper-3 text-xs">
                {assignments.map((a) => (
                  <li key={a.id}>
                    <button onClick={() => setSelected(a)} className={`w-full text-left py-2 px-2 rounded ${selected?.id === a.id ? 'bg-plum-light text-plum' : 'hover:bg-paper-1'}`}>
                      <span className="font-semibold block">{a.title}</span>
                      <span className="font-mono text-ink-3">due {a.dueDate} · /{a.maxMarks} · {a.graded} graded{a.submitted ? ` · ${a.submitted} awaiting grade` : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title={selected ? `${selected.title} (out of ${selected.maxMarks})` : 'Select an assignment'} actions={selected && roster ? <Button onClick={save} disabled={busy}><Save className="w-3.5 h-3.5" />Save grades</Button> : undefined}>
          {!selected ? <p className="text-xs text-ink-2">Choose an assignment on the left, or create one.</p> : !roster ? <Loading /> : roster.length === 0 ? (
            <p className="text-xs text-ink-2">No students are enrolled in this course.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead><tr className="border-b border-paper-3 font-mono text-[10px] uppercase tracking-widest text-ink-3"><th className="py-2">Student</th><th className="py-2">Roll number</th><th className="py-2">Status</th><th className="py-2 text-right">Marks</th></tr></thead>
              <tbody className="divide-y divide-paper-3">
                {roster.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 font-semibold text-ink-0">{s.fullName}</td>
                    <td className="py-2 font-mono text-ink-3">{s.rollNumber}</td>
                    <td className="py-2 font-mono text-ink-3">{s.status ?? '—'}</td>
                    <td className="py-2 text-right">
                      <input type="number" min="0" max={selected.maxMarks} step="0.5" className={`${inputClass} w-24 text-right inline-block`} value={marks[s.id] ?? ''} onChange={(e) => setMarks({ ...marks, [s.id]: e.target.value })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
