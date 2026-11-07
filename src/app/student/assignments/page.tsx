'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { Send, X } from 'lucide-react';
import { Button, Loading, NoticeBox, Panel, errorNotice, inputClass, labelClass, type Notice } from '@/components/twin/ui';

interface Assignment {
  id: string; title: string; description: string | null; maxMarks: number; dueDate: string;
  course: { code: string; name: string }; status: string | null; marksObtained: number | null; submittedAt: string | null;
  content: string | null; link: string | null;
}

const STATUS: Record<string, string> = { SUBMITTED: 'Submitted', LATE: 'Submitted late', GRADED: 'Graded', DRAFT: 'Draft' };

export default function StudentAssignmentsPage() {
  const [items, setItems] = useState<Assignment[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [work, setWork] = useState({ content: '', link: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/student/assignments');
    if (!res.ok) { setNotice(await errorNotice(res)); setItems([]); return; }
    setItems((await res.json()).assignments);
  }, []);
  useEffect(() => { load(); }, [load]);

  function start(a: Assignment) {
    setOpen(a.id);
    setWork({ content: a.content ?? '', link: a.link ?? '' });
    setNotice(null);
  }

  async function submit(id: string) {
    setBusy(true); setNotice(null);
    const res = await fetch(`/api/student/assignments/${id}/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(work),
    });
    setBusy(false);
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    const { submission } = await res.json();
    setNotice({ kind: 'ok', text: submission.status === 'LATE' ? 'Submitted (after the due date).' : 'Submitted.' });
    setOpen(null);
    await load();
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="page-title font-baskerville italic text-3xl">Assignments</h1>
      <NoticeBox notice={notice} />
      <Panel>
        {!items ? <Loading /> : items.length === 0 ? <p className="text-xs text-ink-2">No assignments in your courses.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="border-b border-paper-3 font-mono text-[10px] uppercase tracking-widest text-ink-3"><th className="py-2">Assignment</th><th className="py-2">Due</th><th className="py-2">Status</th><th className="py-2 text-right">Marks</th><th /></tr></thead>
              <tbody className="divide-y divide-paper-3">
                {items.map((a) => (
                  <Fragment key={a.id}>
                    <tr>
                      <td className="py-2"><span className="font-semibold text-ink-0 block">{a.title}</span><span className="font-mono text-ink-3">{a.course.code}</span></td>
                      <td className="py-2 font-mono text-ink-2">{new Date(a.dueDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                      <td className="py-2 font-mono text-ink-2">{a.status ? STATUS[a.status] ?? a.status : 'Not submitted'}</td>
                      <td className="py-2 text-right font-space text-ink-0">{a.marksObtained !== null ? `${a.marksObtained}/${a.maxMarks}` : '—'}</td>
                      <td className="py-2 text-right">
                        {a.status !== 'GRADED' && open !== a.id && (
                          <Button variant={a.status ? 'ghost' : 'primary'} onClick={() => start(a)}><Send className="w-3.5 h-3.5" />{a.status ? 'Edit submission' : 'Submit'}</Button>
                        )}
                      </td>
                    </tr>
                    {open === a.id && (
                      <tr><td colSpan={5} className="py-3">
                        <div className="space-y-3 bg-paper-1 border border-paper-3 rounded p-3">
                          {a.description && <p className="text-xs text-ink-2">{a.description}</p>}
                          <div>
                            <label htmlFor={`ans-${a.id}`} className={labelClass}>Your answer (optional if you add a link)</label>
                            <textarea id={`ans-${a.id}`} rows={5} maxLength={10000} className={inputClass} value={work.content} onChange={(e) => setWork({ ...work, content: e.target.value })} />
                          </div>
                          <div>
                            <label htmlFor={`link-${a.id}`} className={labelClass}>Link to your work (Google Drive, GitHub, …)</label>
                            <input id={`link-${a.id}`} type="url" className={inputClass} placeholder="https://" value={work.link} onChange={(e) => setWork({ ...work, link: e.target.value })} />
                          </div>
                          <p className="text-[11px] text-ink-3">Due {new Date(a.dueDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}. Work handed in after that is marked late.</p>
                          <div className="flex gap-2">
                            <Button onClick={() => submit(a.id)} disabled={busy || (!work.content.trim() && !work.link.trim())}><Send className="w-3.5 h-3.5" />{busy ? 'Submitting…' : 'Submit'}</Button>
                            <Button variant="ghost" onClick={() => setOpen(null)}><X className="w-3.5 h-3.5" />Cancel</Button>
                          </div>
                        </div>
                      </td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
