'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { GeneratedQuizFaculty } from '@/components/twin/generated-quiz-faculty';

type StudentDetail = {
  studentId: string;
  fullName: string;
  rollNumber: string;
  masteryScore: number;
  highestTier: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'NONE';
  attemptCount: number;
  totalTimeMinutes: number;
  lastAttemptAt: string | null;
  status: 'Struggling' | 'Developing' | 'Progressing';
};

type Topic = {
  key: string;
  name: string;
  students: number;
  stuckStudents: number;
  advancingStudents: number;
  averageTimeMinutes: number;
  tierCounts: Record<string, number>;
  studentDetails: StudentDetail[];
};

export default function FacultyTopicMasteryPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch(`/api/faculty/courses/${encodeURIComponent(courseId)}/topic-mastery`, {
      credentials: 'same-origin',
      signal: controller.signal
    })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load topic mastery');
        setTopics(data.topics || []);
      })
      .catch(err => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [courseId]);

  const pct = (score: number) => `${Math.round(score * 100)}%`;

  return (
    <main className="max-w-6xl mx-auto space-y-5">
      <Link className="underline text-sm" href={`/faculty/courses/${courseId}`}>← Course</Link>
      <h1 className="text-3xl font-semibold">Topic mastery across students</h1>
      <p className="text-sm text-ink-2">
        Only active syllabi and students enrolled in your course are included.
        Expand a topic to identify which students need support.
      </p>
      {loading && <p role="status">Loading topic mastery…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && topics.length === 0 && <p>No topic mastery records yet.</p>}
      {!loading && !error && (
        <div className="space-y-4">
          {topics.map(topic => (
            <article key={topic.key} className="border border-paper-3 bg-paper-0 rounded p-4 space-y-2">
              <h2 className="font-semibold text-lg">{topic.name}</h2>
              <p className="text-sm">
                {topic.students} students · {topic.stuckStudents} below 50% ·{' '}
                {topic.advancingStudents} at or above 70%
              </p>
              <p className="text-xs">
                Tier evidence: {Object.entries(topic.tierCounts).map(([tier, count]) =>
                  `${tier} ${count}`).join(' · ') || 'None'}
              </p>
              <details className="pt-2">
                <summary className="cursor-pointer underline font-medium">
                  View students ({topic.studentDetails?.length ?? 0})
                </summary>
                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-paper-3">
                        <th scope="col" className="p-2">Student</th>
                        <th scope="col" className="p-2">Roll number</th>
                        <th scope="col" className="p-2">Mastery</th>
                        <th scope="col" className="p-2">Highest tier</th>
                        <th scope="col" className="p-2">Attempts</th>
                        <th scope="col" className="p-2">Time</th>
                        <th scope="col" className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(topic.studentDetails || []).map(student => (
                        <tr key={student.studentId} className="border-b border-paper-3">
                          <td className="p-2 font-medium">{student.fullName}</td>
                          <td className="p-2">{student.rollNumber}</td>
                          <td className="p-2">{pct(student.masteryScore)}</td>
                          <td className="p-2">{student.highestTier}</td>
                          <td className="p-2">{student.attemptCount}</td>
                          <td className="p-2">{student.totalTimeMinutes} min</td>
                          <td className="p-2">{student.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </article>
          ))}
        </div>
      )}
    <GeneratedQuizFaculty courseId={courseId}/></main>
  );
}
