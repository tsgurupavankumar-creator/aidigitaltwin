'use client';

import { useCallback, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Button, Loading, NoticeBox, Panel, errorNotice, type Notice } from '@/components/twin/ui';

interface Assignment {
  id: string; title: string; description: string | null; maxMarks: number; dueDate: string;
  course: { code: string; name: string }; status: string | null; marksObtained: number | null; submittedAt: string | null;
}

export default function StudentAssignmentsPage() {
  const [items, setItems] = useState<Assignment[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/student/assignments');
    if (!res.ok) { setNotice(await errorNotice(res)); setItems([]); return; }
    setItems((await res.json()).assignments);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit(id: string) {
    setBusy(id); setNotice(null);
    const res = await fetch(`/api/student/assignments/${id}/submit`, { method: 'POST' });
    setBusy(null);
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    const { submission } = await res.json();
    setNotice({ kind: 'ok', text: submission.status === 'LATE' ? 'Marked as submitted (late).' : 'Marked as submitted.' });
    await load();
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="font-baskerville italic text-3xl text-ink-0">Assignments</h1>
      <NoticeBox notice={notice} />
      <Panel>
        {!items ? <Loading /> : items.length === 0 ? <p className="text-xs text-ink-2">No assignments in your courses.</p> : (
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b border-paper-3 font-mono text-[10px] uppercase tracking-widest text-ink-3"><th className="py-2">Assignment</th><th className="py-2">Due</th><th className="py-2">Status</th><th className="py-2 text-right">Marks</th><th /></tr></thead>
            <tbody className="divide-y divide-paper-3">
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="py-2"><span className="font-semibold text-ink-0 block">{a.title}</span><span className="font-mono text-ink-3">{a.course.code}</span></td>
                  <td className="py-2 font-mono text-ink-2">{new Date(a.dueDate).toLocaleDateString()}</td>
                  <td className="py-2 font-mono text-ink-2">{a.status ?? 'Not submitted'}</td>
                  <td className="py-2 text-right font-space">{a.marksObtained !== null ? `${a.marksObtained}/${a.maxMarks}` : '—'}</td>
                  <td className="py-2 text-right">
                    {a.status !== 'GRADED' && (
                      <Button variant={a.status ? 'ghost' : 'primary'} onClick={() => submit(a.id)} disabled={busy === a.id}><Send className="w-3.5 h-3.5" />{a.status ? 'Resubmit' : 'Submit'}</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
