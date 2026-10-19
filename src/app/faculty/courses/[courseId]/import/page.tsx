'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Upload } from 'lucide-react';
import { BackLink, Button, NoticeBox, Panel, errorNotice, inputClass, labelClass, type Notice } from '@/components/twin/ui';

const EXAMPLES = {
  attendance: 'rollNumber,date,status,time,room\n24BCE0480,2026-10-20,P,10:00,B-204\n24BCE2038,2026-10-20,A,10:00,B-204',
  grades: 'rollNumber,assignment,marks\n24BCE0480,ER Design,17\n24BCE2038,ER Design,12.5',
};

export default function ImportPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [kind, setKind] = useState<'attendance' | 'grades'>('attendance');
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_000_000) { setNotice({ kind: 'error', text: 'The file is larger than 1 MB.' }); return; }
    setCsv(await file.text());
  }

  async function submit() {
    setBusy(true); setNotice(null);
    const res = await fetch(`/api/faculty/courses/${courseId}/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, csv }) });
    setBusy(false);
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    const b = await res.json();
    setNotice({
      kind: 'ok',
      text: `Imported ${b.rows} rows: ${b.saved} saved, ${b.unchanged} unchanged${b.lecturesCreated ? `, ${b.lecturesCreated} new lecture(s)` : ''}. Digital twins updating for ${b.twinUpdatesQueued} student(s) in the background.`,
    });
    setCsv('');
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <BackLink href={`/faculty/courses/${courseId}`} label="Back to course" />
      <h1 className="font-baskerville italic text-3xl text-ink-0">Import CSV</h1>
      <NoticeBox notice={notice} />
      <Panel>
        <div className="flex gap-2">
          {(['attendance', 'grades'] as const).map((k) => (
            <Button key={k} variant={kind === k ? 'primary' : 'ghost'} onClick={() => setKind(k)}>{k === 'attendance' ? 'Attendance' : 'Grades'}</Button>
          ))}
        </div>
        <div className="text-xs text-ink-2 space-y-1">
          {kind === 'attendance' ? (
            <p>Columns: <code>rollNumber</code>, <code>date</code> (YYYY-MM-DD), <code>status</code> (PRESENT, ABSENT, LATE, EXCUSED or P/A/L/E), optional <code>time</code> and <code>room</code>. A date with no lecture gets one; if a date has several lectures, include <code>time</code>.</p>
          ) : (
            <p>Columns: <code>rollNumber</code>, <code>assignment</code> (exact title in this course), <code>marks</code>.</p>
          )}
          <p>Every row is checked first. If any row has a problem, nothing is saved and each problem is listed with its row number.</p>
        </div>
        <div><label className={labelClass}>File</label><input type="file" accept=".csv,text/csv" onChange={(e) => readFile(e.target.files?.[0])} className="text-xs" /></div>
        <div><label className={labelClass}>Or paste</label><textarea className={`${inputClass} font-mono`} rows={10} placeholder={EXAMPLES[kind]} value={csv} onChange={(e) => setCsv(e.target.value)} /></div>
        <Button onClick={submit} disabled={busy || !csv.trim()}><Upload className="w-3.5 h-3.5" />Import</Button>
      </Panel>
    </div>
  );
}
