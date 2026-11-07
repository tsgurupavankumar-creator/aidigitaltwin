'use client';
import { useEffect, useState } from 'react';
type Row = { topic: string; studentId: string; fullName: string; rollNumber: string; correct: number; answered: number; percentage: number; lastAt: string };
export function GeneratedQuizFaculty({ courseId }: { courseId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    fetch(`/api/faculty/courses/${courseId}/generated-quiz-performance`)
      .then(async res => { const data = await res.json(); if (!res.ok) throw Error(data.error || 'Could not fetch results'); return data; })
      .then(data => { if (live) setRows(data.rows ?? []); })
      .catch(err => { if (live) setError(err instanceof Error ? err.message : 'Unavailable'); });
    return () => { live = false; };
  }, [courseId]);
  return <section className="mt-8 space-y-3">
    <h2 className="text-xl font-semibold">Generated quiz performance (supplementary)</h2>
    <p className="text-sm text-ink-2">Separate from Beginner/Intermediate/Advanced mastery. Scores here never unlock practice tiers.</p>
    {error && <p role="alert" className="text-sm text-burgundy">{error}</p>}
    {!error && rows.length === 0 && <p className="text-sm">No generated quiz submissions for active syllabi.</p>}
    {rows.length > 0 && <div className="overflow-x-auto border rounded"><table className="w-full text-sm text-left"><thead><tr className="border-b"><th className="p-2">Topic</th><th className="p-2">Student</th><th className="p-2">Roll no.</th><th className="p-2">Correct</th><th className="p-2">Score</th></tr></thead><tbody>
      {rows.map(row => <tr key={`${row.studentId}:${row.topic}`} className="border-b"><td className="p-2">{row.topic}</td><td className="p-2">{row.fullName}</td><td className="p-2">{row.rollNumber}</td><td className="p-2">{row.correct}/{row.answered}</td><td className="p-2">{row.percentage}%</td></tr>)}
    </tbody></table></div>}
  </section>;
}
