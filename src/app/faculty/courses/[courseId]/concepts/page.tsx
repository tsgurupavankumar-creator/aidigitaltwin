'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Pencil, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { BackLink, Button, Loading, NoticeBox, Panel, errorNotice, inputClass, labelClass, type Notice } from '@/components/twin/ui';

interface Concept {
  id: string; name: string; difficulty: number; topic: string | null;
  prerequisiteIds: string[]; questionCount: number; masteryCount: number;
}
const empty = { name: '', topic: '', difficulty: 3, prerequisiteIds: [] as string[] };

export default function ConceptsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [concepts, setConcepts] = useState<Concept[] | null>(null);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/faculty/courses/${courseId}/concepts`);
    if (!res.ok) { setNotice(await errorNotice(res)); setConcepts([]); return; }
    setConcepts((await res.json()).concepts);
  }, [courseId]);
  useEffect(() => { load(); }, [load]);

  const nameOf = (id: string) => concepts?.find((c) => c.id === id)?.name ?? '?';

  async function save() {
    setBusy(true); setNotice(null);
    const body = JSON.stringify({ name: form.name, topic: form.topic || null, difficulty: Number(form.difficulty), prerequisiteIds: form.prerequisiteIds });
    const res = await fetch(editing ? `/api/faculty/courses/${courseId}/concepts/${editing}` : `/api/faculty/courses/${courseId}/concepts`,
      { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body });
    setBusy(false);
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    setNotice({ kind: 'ok', text: editing ? `Saved "${form.name}".` : `Added "${form.name}".` });
    setForm(empty); setEditing(null); load();
  }

  async function remove(c: Concept) {
    if (!confirm(`Delete "${c.name}"?`)) return;
    const res = await fetch(`/api/faculty/courses/${courseId}/concepts/${c.id}`, { method: 'DELETE' });
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    setNotice({ kind: 'ok', text: `Deleted "${c.name}".` }); load();
  }

  async function importCsv() {
    setBusy(true); setNotice(null);
    const res = await fetch(`/api/faculty/courses/${courseId}/concepts/import`, { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: csv });
    setBusy(false);
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    const r = await res.json();
    setNotice({ kind: 'ok', text: `Imported ${r.rows} row(s): ${r.created} new, ${r.updated} updated.` });
    setCsv(''); load();
  }

  function edit(c: Concept) {
    setEditing(c.id);
    setForm({ name: c.name, topic: c.topic ?? '', difficulty: c.difficulty, prerequisiteIds: c.prerequisiteIds });
  }

  const togglePrereq = (id: string) => setForm((f) => ({
    ...f, prerequisiteIds: f.prerequisiteIds.includes(id) ? f.prerequisiteIds.filter((x) => x !== id) : [...f.prerequisiteIds, id],
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <BackLink href={`/faculty/courses/${courseId}`} label="Back to course" />
      <div>
        <h1 className="text-3xl font-libre italic text-ink-0 dark:text-paper-0">Concepts</h1>
        <p className="text-sm text-ink-2 dark:text-paper-3 mt-1">The topics students are assessed on. Quiz questions are linked to concepts, and prerequisites let the twin trace a weakness back to its root cause.</p>
      </div>
      <NoticeBox notice={notice} />

      <Panel title={editing ? 'Edit concept' : 'Add a concept'}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><label htmlFor="c-name" className={labelClass}>Name</label><input id="c-name" className={inputClass} value={form.name} placeholder="e.g. SQL Joins" onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label htmlFor="c-topic" className={labelClass}>Topic (optional)</label><input id="c-topic" className={inputClass} value={form.topic} placeholder="e.g. SQL" onChange={(e) => setForm({ ...form, topic: e.target.value })} /></div>
          <div><label htmlFor="c-diff" className={labelClass}>Difficulty (1 easy – 5 hard)</label>
            <select id="c-diff" className={inputClass} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d}</option>)}
            </select></div>
        </div>
        {concepts && concepts.filter((c) => c.id !== editing).length > 0 && (
          <fieldset>
            <legend className={labelClass}>Prerequisites: concepts a student needs first</legend>
            <div className="flex flex-wrap gap-2">
              {concepts.filter((c) => c.id !== editing).map((c) => (
                <label key={c.id} className={`px-2 py-1 rounded border text-xs cursor-pointer ${form.prerequisiteIds.includes(c.id) ? 'bg-plum text-paper-0 border-plum' : 'bg-paper-0 text-ink-1 border-paper-3'}`}>
                  <input type="checkbox" className="sr-only" checked={form.prerequisiteIds.includes(c.id)} onChange={() => togglePrereq(c.id)} />{c.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="flex gap-2">
          <Button onClick={save} disabled={busy || !form.name.trim()}>{editing ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}{editing ? 'Save' : 'Add concept'}</Button>
          {editing && <Button variant="ghost" onClick={() => { setEditing(null); setForm(empty); }}><X className="w-3.5 h-3.5" />Cancel</Button>}
        </div>
      </Panel>

      <Panel title={`Concepts in this course${concepts ? ` (${concepts.length})` : ''}`}>
        {concepts === null ? <Loading /> : concepts.length === 0 ? (
          <p className="text-xs text-ink-2">No concepts yet. Add them above or import a CSV below; quizzes need at least one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="border-b border-paper-3 font-mono text-[10px] uppercase tracking-widest text-ink-3">
                <th className="py-2">Concept</th><th>Topic</th><th>Difficulty</th><th>Needs first</th><th>Used by</th><th /></tr></thead>
              <tbody className="divide-y divide-paper-3">
                {concepts.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 font-semibold text-ink-0">{c.name}</td>
                    <td className="text-ink-2">{c.topic ?? '—'}</td>
                    <td>{c.difficulty} / 5</td>
                    <td className="text-ink-2">{c.prerequisiteIds.length ? c.prerequisiteIds.map(nameOf).join(', ') : '—'}</td>
                    <td className="text-ink-2">{c.questionCount} question{c.questionCount === 1 ? '' : 's'}, {c.masteryCount} student{c.masteryCount === 1 ? '' : 's'}</td>
                    <td className="text-right whitespace-nowrap">
                      <button type="button" aria-label={`Edit ${c.name}`} className="p-1 text-ink-2 hover:text-plum" onClick={() => edit(c)}><Pencil className="w-3.5 h-3.5" /></button>
                      <button type="button" aria-label={`Delete ${c.name}`} className="p-1 text-ink-2 hover:text-burgundy" onClick={() => remove(c)}><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Import from CSV">
        <p className="text-xs text-ink-2">Columns: <code>name, topic, difficulty, prerequisites</code>. Separate several prerequisites with <code>;</code>. Existing concepts with the same name are updated. All rows are saved, or none if any row has an error.</p>
        <label htmlFor="c-csv" className={labelClass}>CSV</label>
        <textarea id="c-csv" rows={6} className={`${inputClass} font-mono`} value={csv} onChange={(e) => setCsv(e.target.value)}
          placeholder={'name,topic,difficulty,prerequisites\nKeys,Relational model,2,\nSQL Joins,SQL,3,Keys\nNormalization,Design,4,Keys; SQL Joins'} />
        <Button onClick={importCsv} disabled={busy || !csv.trim()}><Upload className="w-3.5 h-3.5" />Import</Button>
      </Panel>
    </div>
  );
}
