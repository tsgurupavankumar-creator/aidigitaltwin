'use client';

import { useEffect, useState } from 'react';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { GraduationCap, Users, ArrowRight, Loader2, RotateCcw, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { NewCourseForm } from '@/components/twin/CourseManagement';

interface CourseItem {
  id: string;
  code: string;
  name: string;
  department: string;
  term: string;
  schedule: string | null;
  studentIds: string[];
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCourses = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/faculty/courses');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load assigned courses');
      setCourses(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load courses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <span className="font-mono text-xs text-plum uppercase tracking-widest font-medium">
            01 / CURRICULUM MANAGEMENT
          </span>
          <h1 className="font-baskerville italic font-normal text-4xl text-ink-0">
            Assigned Courses & Roster
          </h1>
          <p className="text-sm text-ink-2 font-dmsans">
            Active course sections, subject codes, and student enrollment totals.
          </p>
        </div>
      </div>

      <HairlineRule variant="plum" />

      <NewCourseForm />

      {loading ? (
        <div className="p-16 rounded-md bg-paper-0 border border-paper-3 flex flex-col items-center justify-center gap-3 text-ink-2">
          <Loader2 className="w-8 h-8 animate-spin text-plum" />
          <span className="font-mono text-xs uppercase tracking-wider">Loading curriculum courses...</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-md bg-burgundy/10 border border-burgundy/20 space-y-3">
          <p className="text-sm font-semibold text-burgundy">{error}</p>
          <button
            onClick={fetchCourses}
            className="px-3 py-1.5 text-xs font-mono rounded bg-plum text-paper-0 hover:bg-plum/90 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : courses.length === 0 ? (
        <div className="p-16 rounded-md bg-paper-0 border border-paper-3 text-center space-y-2">
          <GraduationCap className="w-8 h-8 text-ink-3 mx-auto" />
          <h3 className="font-semibold text-ink-0 text-sm">No Courses Assigned</h3>
          <p className="text-xs text-ink-2">You have no courses yet. Use New course above to create one, then enroll students.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {courses.map((course) => (
            <div
              key={course.id}
              className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="px-2 py-0.5 rounded bg-plum-light text-plum font-semibold border border-plum/20">
                    {course.code}
                  </span>
                  <span className="text-ink-3">{course.term}</span>
                </div>
                <h3 className="font-inter font-bold text-xl text-ink-0">{course.name}</h3>
                <p className="text-xs text-ink-2">
                  Schedule: {course.schedule ?? 'not set'}
                </p>
              </div>

              <div className="pt-4 border-t border-paper-3 flex items-center justify-between">
                <span className="font-mono text-xs text-ink-2 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-ink-3" />
                  {course.studentIds.length} Students Enrolled
                </span>
                <Link
                  href={`/faculty/courses/${course.id}`}
                  className="text-plum hover:underline font-mono text-xs font-semibold flex items-center gap-1"
                >
                  <span>MANAGE ROSTER</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
