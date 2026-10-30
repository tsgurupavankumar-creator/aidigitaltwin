'use client';

import { useEffect, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FlaskConical } from 'lucide-react';
import { Button, NoticeBox, Panel, errorNotice, inputClass, labelClass, type Notice } from './ui';

interface Snapshot {
  createdAt: string; academicHealth: number; attendanceScore: number; engagementScore: number;
  knowledgeScore: number; performanceScore: number; behaviorScore: number; skillsScore: number;
  learningVelocity: number; riskScore: number | null; riskLevel: string | null; event: string;
}

const SERIES: Array<[keyof Snapshot, string, string]> = [
  ['academicHealth', 'Academic health', '#2C3E50'],
  ['attendanceScore', 'Attendance', '#7A8B5C'],
  ['engagementScore', 'Engagement', '#C0623E'],
  ['knowledgeScore', 'Knowledge', '#6B4E5C'],
  ['riskScore', 'Risk', '#9B2C2C'],
];

/** The twin's history: how the student's state moved with each update. */
export function TwinTrajectory({ endpoint }: { endpoint: string }) {
  const [rows, setRows] = useState<Snapshot[] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    fetch(endpoint).then(async (res) => {
      if (!res.ok) { setNotice(await errorNotice(res)); setRows([]); return; }
      setRows((await res.json()).history);
    });
  }, [endpoint]);
  const data = (rows ?? []).map((r) => ({ ...r, when: new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }));
  return (
    <Panel title="Twin trajectory">
      <NoticeBox notice={notice} />
      {rows === null ? <p className="text-xs text-ink-2">Loading…</p> : rows.length < 2 ? (
        <p className="text-xs text-ink-2">{rows.length === 0 ? 'No history yet.' : 'One update so far.'} A point is added each time the twin updates (attendance, grades, quizzes, weekly review).</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="#E8E2D9" strokeDasharray="3 3" />
              <XAxis dataKey="when" stroke="#9C958E" fontSize={11} fontFamily="JetBrains Mono" />
              <YAxis domain={[0, 100]} stroke="#9C958E" fontSize={11} fontFamily="JetBrains Mono" />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {SERIES.map(([key, name, color]) => (
                <Line key={key} type="monotone" dataKey={key} name={name} stroke={color} strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

interface Outcome { riskProbability: number; riskLevel: string; riskScore: number; predictedMark: number | null; markRange: { low: number; high: number } | null }
interface Result {
  current: { attendancePct: number; quizAveragePct: number | null; missedAssignments: number; lateAssignments: number };
  baseline: Outcome; simulated: Outcome; assumptions: string[];
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const mark = (o: Outcome) => (o.predictedMark === null ? '—' : `${Math.round(o.predictedMark)}%${o.markRange ? ` (${Math.round(o.markRange.low)}–${Math.round(o.markRange.high)})` : ''}`);

/** What if…: change a few inputs and see what the SAME trained models predict. Nothing is saved. */
export function WhatIfPanel({ endpoint, audience = 'faculty' }: { endpoint: string; audience?: 'faculty' | 'student' }) {
  const [form, setForm] = useState({ attendancePct: '', quizAveragePct: '', missedAssignments: '', lateAssignments: '' });
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function run() {
    const scenario = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, Number(v)]));
    if (!Object.keys(scenario).length) { setNotice({ kind: 'error', text: 'Change at least one input.' }); return; }
    setBusy(true); setNotice(null);
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scenario) });
    setBusy(false);
    if (!res.ok) { setNotice(await errorNotice(res)); return; }
    setResult(await res.json());
  }

  const field = (key: keyof typeof form, label: string, placeholder: string) => (
    <div><label className={labelClass} htmlFor="ts-twin-twinexplorer-tsx-f1">{label}</label>
      <input id="ts-twin-twinexplorer-tsx-f1" type="number" min="0" max={key.endsWith('Pct') ? 100 : 50} className={inputClass} placeholder={placeholder}
        value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></div>
  );
  const c = result?.current;

  return (
    <Panel title="What if…">
      <p className="text-xs text-ink-2">
        {audience === 'student' ? 'See how changes in your attendance or work could change your predicted risk and next mark.' : 'Explore how changes in this student\'s attendance or work would change the predicted risk and next mark.'}{' '}
        Uses the same trained models; nothing is saved.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {field('attendancePct', 'Attendance %', c ? String(Math.round(c.attendancePct)) : 'e.g. 90')}
        {field('quizAveragePct', 'Quiz average %', c?.quizAveragePct != null ? String(Math.round(c.quizAveragePct)) : 'e.g. 75')}
        {field('missedAssignments', 'Missed assignments', c ? String(c.missedAssignments) : 'e.g. 0')}
        {field('lateAssignments', 'Late assignments', c ? String(c.lateAssignments) : 'e.g. 0')}
      </div>
      <Button onClick={run} disabled={busy}><FlaskConical className="w-3.5 h-3.5" />{busy ? 'Simulating…' : 'Simulate'}</Button>
      <NoticeBox notice={notice} />
      {result && (
        <div className="space-y-2 text-xs">
          <div className="overflow-x-auto"><table className="w-full text-left">
            <thead><tr className="border-b border-paper-3 font-mono text-[10px] uppercase tracking-widest text-ink-3"><th className="py-1.5" /><th>Now</th><th>What if</th></tr></thead>
            <tbody className="divide-y divide-paper-3">
              <tr><td className="py-1.5 text-ink-2">Risk level</td><td className="font-semibold">{result.baseline.riskLevel}</td><td className="font-semibold">{result.simulated.riskLevel}</td></tr>
              <tr><td className="py-1.5 text-ink-2">Chance of failing or withdrawing</td><td>{pct(result.baseline.riskProbability)}</td><td>{pct(result.simulated.riskProbability)}</td></tr>
              <tr><td className="py-1.5 text-ink-2">Predicted next mark (likely range)</td><td>{mark(result.baseline)}</td><td>{mark(result.simulated)}</td></tr>
            </tbody>
          </table></div>
          <details className="text-ink-3"><summary className="cursor-pointer">Assumptions</summary><ul className="list-disc pl-5 mt-1">{result.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></details>
        </div>
      )}
    </Panel>
  );
}

export function TwinExplorer({ whatIfEndpoint, historyEndpoint, audience }: { whatIfEndpoint: string; historyEndpoint: string; audience?: 'faculty' | 'student' }) {
  return (
    <div className="space-y-6">
      <TwinTrajectory endpoint={historyEndpoint} />
      <WhatIfPanel endpoint={whatIfEndpoint} audience={audience} />
    </div>
  );
}

