'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
type Course = { id: string; code: string; name: string };
export default function MyCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { fetch('/api/student/enrolled-courses').then(r => r.json()).then(d => setCourses(d.courses || [])).catch(() => setError('Unable to load courses')); }, []);
  return <main className="max-w-5xl mx-auto space-y-6"><h1 className="text-3xl font-semibold">My learning courses</h1>
    {error && <p role="alert">{error}</p>}{courses.length === 0 && <p>No enrolled courses found.</p>}
    <div className="grid gap-4 md:grid-cols-2">{courses.map(course => <Link key={course.id} href={`/student/courses/${course.id}`} className="rounded-xl border border-paper-3 bg-paper-0 p-5 hover:border-terracotta">
      <p className="font-mono text-sm text-ink-3">{course.code}</p><h2 className="font-semibold text-lg">{course.name}</h2><p className="text-sm text-terracotta mt-3">Open learning graph →</p>
    </Link>)}</div></main>;
}
