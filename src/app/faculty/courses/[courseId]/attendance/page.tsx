'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Save } from 'lucide-react';
import { BackLink, Button, Loading, NoticeBox, Panel, errorNotice, inputClass, labelClass, savedNotice, type Notice } from '@/components/twin/ui';

type Status = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
const STATUSES: Status[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
const SHORT: Record<Status, string> = { PRESENT: 'P', ABSENT: 'A', LATE: 'L', EXCUSED: 'E' };

interface LectureRow { id: string; date: string; time: string; room: string; marked: number; attended: number }
interface RosterRow { id: string; rollNumber: string; fullName: string; status: Status | null }

export default function AttendancePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [lectures, setLectures] = useState<LectureRow[] | null>(null);
  const [enrolled, setEnrolled] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), time: '', room: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const loadLectures = useCallback(async () => {
    const res = await fetch(`/api/faculty/courses/${courseId}/lectures`);
    if (!res.ok) { setNotice(await errorNotice(res)); setLectures([]); return; }
    const body = await res.json();
    setLectures(body.lectures);
    setEnrolled(body.enrolled);
  }, [courseId]);

  const loadRoster = useCallback(async (lectureId: string) => {
    setRoster(null);
    const res = await fetch(`/api/faculty/courses/${courseId}/lectures/${lectureId}/attendance`);
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    const body = await res.json();
    setRoster(body.students);
    setMarks(Object.fromEntries(body.students.filter((s: RosterRow) => s.status).map((s: RosterRow) => [s.id, s.status])));
  }, [courseId]);

  useEffect(() => { loadLectures(); }, [loadLectures]);
  useEffect(() => { if (selected) loadRoster(selected); }, [selected, loadRoster]);

  async function createLecture() {
    setBusy(true); setNotice(null);
    const res = await fetch(`/api/faculty/courses/${courseId}/lectures`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setBusy(false);
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    const { lecture } = await res.json();
    await loadLectures();
    setSelected(lecture.id);
  }

  async function save() {
    if (!selected) return;
    const records = Object.entries(marks).map(([studentId, status]) => ({ studentId, status }));
    if (!records.length) { setNotice({ kind: 'error', text: 'Mark at least one student first.' }); return; }
    setBusy(true); setNotice(null);
    const res = await fetch(`/api/faculty/courses/${courseId}/lectures/${selected}/attendance`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ records }) });
    setBusy(false);
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    setNotice(savedNotice(await res.json(), 'attendance mark'));
    await Promise.all([loadLectures(), loadRoster(selected)]);
  }

  const markAll = (status: Status) => roster && setMarks(Object.fromEntries(roster.map((s) => [s.id, status])));

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <BackLink href={`/faculty/courses/${courseId}`} label="Back to course" />
      <h1 className="font-baskerville italic text-3xl text-ink-0">Attendance</h1>
      <NoticeBox notice={notice} />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <Panel title="New lecture">
            <div className="space-y-3">
              <div><label className={labelClass}>Date</label><input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelClass}>Time</label><input className={inputClass} placeholder="10:00" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
                <div><label className={labelClass}>Room</label><input className={inputClass} placeholder="B-204" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></div>
              </div>
              <Button onClick={createLecture} disabled={busy || !form.date}><Plus className="w-3.5 h-3.5" />Add lecture</Button>
            </div>
          </Panel>

          <Panel title="Lectures">
            {!lectures ? <Loading /> : lectures.length === 0 ? <p className="text-xs text-ink-2">No lectures yet.</p> : (
              <ul className="divide-y divide-paper-3 text-xs">
                {lectures.map((l) => (
                  <li key={l.id}>
                    <button onClick={() => setSelected(l.id)} className={`w-full text-left py-2 px-2 rounded flex justify-between ${selected === l.id ? 'bg-plum-light text-plum' : 'hover:bg-paper-1'}`}>
                      <span className="font-mono">{l.date}{l.time ? ` · ${l.time}` : ''}{l.room ? ` · ${l.room}` : ''}</span>
                      <span className="font-mono text-ink-3">{l.marked ? `${l.attended}/${l.marked}` : `0/${enrolled} marked`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel
          title={selected ? 'Mark attendance' : 'Select a lecture'}
          actions={selected && roster ? (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => markAll('PRESENT')}>All present</Button>
              <Button onClick={save} disabled={busy}><Save className="w-3.5 h-3.5" />Save</Button>
            </div>
          ) : undefined}
        >
          {!selected ? <p className="text-xs text-ink-2">Choose a lecture on the left, or add one.</p> : !roster ? <Loading /> : roster.length === 0 ? (
            <p className="text-xs text-ink-2">No students are enrolled in this course.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead><tr className="border-b border-paper-3 font-mono text-[10px] uppercase tracking-widest text-ink-3"><th className="py-2">Student</th><th className="py-2">Roll number</th><th className="py-2 text-right">Status</th></tr></thead>
              <tbody className="divide-y divide-paper-3">
                {roster.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 font-semibold text-ink-0">{s.fullName}</td>
                    <td className="py-2 font-mono text-ink-3">{s.rollNumber}</td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1">
                        {STATUSES.map((st) => (
                          <button key={st} title={st} onClick={() => setMarks({ ...marks, [s.id]: st })}
                            className={`w-8 h-7 rounded font-mono text-[11px] border ${marks[s.id] === st ? (st === 'ABSENT' ? 'bg-burgundy text-paper-0 border-burgundy' : 'bg-plum text-paper-0 border-plum') : 'bg-paper-0 border-paper-3 text-ink-2 hover:bg-paper-1'}`}>
                            {SHORT[st]}
                          </button>
                        ))}
                      </div>
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
