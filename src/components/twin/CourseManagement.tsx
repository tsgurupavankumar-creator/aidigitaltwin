'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import { Button, NoticeBox, Panel, errorNotice, inputClass, labelClass, type Notice } from './ui';

/** Create a course. The server generates the course code. */
export function NewCourseForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', department: '', semester: '1', credits: '3' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function create() {
    setBusy(true); setNotice(null);
    const res = await fetch('/api/faculty/courses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, department: form.department, semester: Number(form.semester), credits: Number(form.credits) }),
    });
    setBusy(false);
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    const { data } = await res.json();
    router.push(`/faculty/courses/${data.id}`);
  }

  if (!open) return <Button onClick={() => setOpen(true)}><Plus className="w-3.5 h-3.5" />New course</Button>;
  return (
    <Panel title="New course">
      <NoticeBox notice={notice} />
      <div className="grid gap-3 md:grid-cols-[2fr_1.5fr_1fr_1fr]">
        <div><label className={labelClass}>Name</label><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Database Systems" /></div>
        <div><label className={labelClass}>Department</label><input className={inputClass} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="CSE" /></div>
        <div><label className={labelClass}>Semester</label>
          <select className={inputClass} value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>
        </div>
        <div><label className={labelClass}>Credits</label><input type="number" min="1" max="10" className={inputClass} value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} /></div>
      </div>
      <div className="flex gap-2">
        <Button onClick={create} disabled={busy || !form.name.trim() || !form.department.trim()}><Plus className="w-3.5 h-3.5" />Create</Button>
        <Button variant="ghost" onClick={() => { setOpen(false); setNotice(null); }}>Cancel</Button>
      </div>
    </Panel>
  );
}

/** Enroll by roll number (preferred) or exact full name, one per line. */
export function EnrollStudentsPanel({ courseId, onEnrolled }: { courseId: string; onEnrolled: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function enroll() {
    const entries = [...new Set(text.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean))];
    if (!entries.length) return;
    setBusy(true); setNotice(null);
    let added = 0, already = 0;
    const failures: string[] = [];
    for (const studentName of entries) {
      const res = await fetch(`/api/faculty/courses/${courseId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentName }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) failures.push(`${studentName}: ${body.error || `HTTP ${res.status}`}`);
      else if (body.data?.alreadyEnrolled) already += 1;
      else added += 1;
    }
    setBusy(false);
    setNotice({
      kind: failures.length && !added ? 'error' : 'ok',
      text: `Enrolled ${added}${already ? `, ${already} already enrolled` : ''}${failures.length ? `, ${failures.length} not enrolled` : ''}.`,
      details: failures,
    });
    if (added) { setText(''); onEnrolled(); }
  }

  return (
    <Panel title="Enroll students">
      <p className="text-xs text-ink-2">One roll number per line (or comma separated). An exact full name also works if it matches only one student.</p>
      <textarea className={`${inputClass} font-mono`} rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={'24BCE0480\n24BCE2038'} />
      <Button onClick={enroll} disabled={busy || !text.trim()}><UserPlus className="w-3.5 h-3.5" />{busy ? 'Enrolling...' : 'Enroll'}</Button>
      <NoticeBox notice={notice} />
    </Panel>
  );
}

/** Create a student account, profile, digital twin and enrollment for this course. */
export function AddStudentPanel({
  courseId,
  department,
  onAdded,
}: {
  courseId: string;
  department: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    rollNumber: '',
    dob: '',
    email: '',
    department,
    year: '1',
    semester: '1',
    section: '',
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');

  async function createStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    setTemporaryPassword('');

    try {
      const res = await fetch('/api/faculty/students/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          year: Number(form.year),
          semester: Number(form.semester),
          courseId,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setNotice({ kind: 'error', text: body.error || `Request failed (HTTP ${res.status})` });
        return;
      }

      setTemporaryPassword(body.data.temporaryPassword);
      setNotice({ kind: 'ok', text: `${body.data.student.fullName} was added to this course.` });
      setForm({
        fullName: '',
        rollNumber: '',
        dob: '',
        email: '',
        department,
        year: '1',
        semester: '1',
        section: '',
      });
      onAdded();
    } catch {
      setNotice({ kind: 'error', text: 'Unable to add student. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => { setOpen(true); setNotice(null); setTemporaryPassword(''); }}>
        <UserPlus className="w-3.5 h-3.5" />Add student
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-0/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setOpen(false);
          }}
        >
          <section
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md border border-paper-3 bg-paper-0 p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-student-title"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 id="add-student-title" className="font-baskerville italic text-2xl text-ink-0">Add student</h2>
                <p className="mt-1 text-xs text-ink-2">Create an account and enroll the student in this course.</p>
              </div>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Close</Button>
            </div>

            <form onSubmit={createStudent} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="new-student-name" className={labelClass}>Full name</label>
                  <input id="new-student-name" className={inputClass} required maxLength={120} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="new-student-roll" className={labelClass}>Roll number</label>
                  <input id="new-student-roll" className={inputClass} required maxLength={50} value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="new-student-dob" className={labelClass}>Date of birth</label>
                  <input id="new-student-dob" type="date" className={inputClass} required max={new Date().toISOString().slice(0, 10)} value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="new-student-email" className={labelClass}>Email</label>
                  <input id="new-student-email" type="email" className={inputClass} required maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="new-student-department" className={labelClass}>Department</label>
                  <input id="new-student-department" className={inputClass} required maxLength={100} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="new-student-section" className={labelClass}>Section</label>
                  <input id="new-student-section" className={inputClass} required maxLength={20} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="new-student-year" className={labelClass}>Year</label>
                  <select id="new-student-year" className={inputClass} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>
                    {Array.from({ length: 8 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="new-student-semester" className={labelClass}>Semester</label>
                  <select id="new-student-semester" className={inputClass} value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
                    {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                  </select>
                </div>
              </div>

              <NoticeBox notice={notice} />
              {temporaryPassword && (
                <div className="rounded border border-olive/30 bg-olive/10 p-3 text-xs text-ink-0">
                  <p className="font-semibold">Temporary password (share securely with the student)</p>
                  <code className="mt-1 block select-all font-mono text-sm">{temporaryPassword}</code>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
                <Button type="submit" disabled={busy}>
                  <UserPlus className="w-3.5 h-3.5" />{busy ? 'Adding...' : 'Create student'}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

/** Delete an empty course; a course holding data is refused by the server with the reason. */
export function DeleteCourseButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function remove() {
    const res = await fetch(`/api/faculty/courses/${courseId}`, { method: 'DELETE' });
    if (res.ok) { router.push('/faculty/courses'); return; }
    setConfirming(false);
    setNotice(await errorNotice(res));
  }

  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-burgundy">Delete this course permanently?</span>
          <Button onClick={remove}><Trash2 className="w-3.5 h-3.5" />Delete</Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => { setConfirming(true); setNotice(null); }}><Trash2 className="w-3.5 h-3.5" />Delete course</Button>
      )}
      <NoticeBox notice={notice} />
    </div>
  );
}
