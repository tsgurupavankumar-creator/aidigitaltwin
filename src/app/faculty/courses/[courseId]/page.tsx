'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Copy, Check, ArrowLeft, Search, Loader2, RotateCcw, Users, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { CourseActions, CourseInsightPanel } from '@/components/twin/CourseInsightPanel';
import { AddStudentPanel, DeleteCourseButton, EnrollStudentsPanel } from '@/components/twin/CourseManagement';

interface CourseStudent {
  id: string;
  rollNumber: string;
  name: string;
  academicHealth: number | null;
  attendance: number | null;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  riskScore: number | null;
}

interface CourseDetail {
  id: string;
  code: string;
  name: string;
  department: string;
  term: string;
  schedule: string | null;
  students: CourseStudent[];
  atRiskCount: number;
  avgHealth: number | null;
  avgAttendance: number | null;
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchCourseDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/faculty/courses/${courseId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load course detail');
      setCourse(json.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load course');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (courseId) fetchCourseDetail();
  }, [courseId]);

  const copyCode = () => {
    if (!course?.code) return;
    navigator.clipboard.writeText(course.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredStudents = (course?.students || []).filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <Link
        href="/faculty/courses"
        className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-ink-3 hover:text-ink-0 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Courses
      </Link>

      {loading ? (
        <div className="p-16 rounded-md bg-paper-0 border border-paper-3 flex flex-col items-center justify-center gap-3 text-ink-2">
          <Loader2 className="w-8 h-8 animate-spin text-plum" />
          <span className="font-mono text-xs uppercase tracking-wider">Loading course roster and analytics...</span>
        </div>
      ) : error || !course ? (
        <div className="p-6 rounded-md bg-burgundy/10 border border-burgundy/20 space-y-3">
          <p className="text-sm font-semibold text-burgundy">{error || 'Course not found'}</p>
          <button
            onClick={fetchCourseDetail}
            className="px-3 py-1.5 text-xs font-mono rounded bg-plum text-paper-0 hover:bg-plum/90 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : (
        <>
          {/* Header Card */}
          <div className="p-8 rounded-md bg-paper-0 border border-paper-3 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="px-2.5 py-0.5 rounded bg-plum-light text-plum font-semibold border border-plum/20">
                    {course.code}
                  </span>
                  <button
                    onClick={copyCode}
                    className="p-1 rounded hover:bg-paper-2 text-ink-3 hover:text-ink-0 transition-colors"
                    title="Copy Course Code"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-olive" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <span className="text-ink-3">• {course.term}</span>
                </div>
                <h1 className="font-baskerville italic text-3xl sm:text-4xl text-ink-0">{course.name}</h1>
                <p className="font-mono text-xs text-ink-3 uppercase">
                  {course.department} • {course.schedule ?? 'No schedule set'}
                </p>
              </div>

              <div className="flex items-center gap-4 text-center font-space">
                <div className="p-3 rounded bg-paper-1 border border-paper-3 min-w-[90px]">
                  <span className="font-mono text-[10px] text-ink-3 block">ENROLLED</span>
                  <span className="font-bold text-xl text-ink-0">{course.students.length}</span>
                </div>
                <div className="p-3 rounded bg-paper-1 border border-paper-3 min-w-[90px]">
                  <span className="font-mono text-[10px] text-ink-3 block">AVG HEALTH</span>
                  <span className="font-bold text-xl text-plum">{course.avgHealth !== null ? `${course.avgHealth}%` : '—'}</span>
                </div>
                <div className="p-3 rounded bg-paper-1 border border-paper-3 min-w-[90px]">
                  <span className="font-mono text-[10px] text-ink-3 block">AT RISK</span>
                  <span className="font-bold text-xl text-burgundy">{course.atRiskCount}</span>
                </div>
              </div>
            </div>
          </div>

          <CourseActions courseId={course.id} />
          <CourseInsightPanel courseId={course.id} />
          <AddStudentPanel courseId={course.id} department={course.department} onAdded={fetchCourseDetail} />
          <EnrollStudentsPanel courseId={course.id} onEnrolled={fetchCourseDetail} />

          {/* Search bar */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search enrolled students..."
              className="w-full pl-9 pr-3 py-2 text-xs font-dmsans bg-paper-0 border border-paper-3 rounded text-ink-0 placeholder:text-ink-3 outline-none focus:border-plum"
            />
          </div>

          {/* Roster Table */}
          <div className="bg-paper-0 border border-paper-3 rounded-md overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-paper-3 bg-paper-1 text-[11px] font-mono uppercase tracking-widest text-ink-3">
                  <th className="py-3 px-4">RISK</th>
                  <th className="py-3 px-4">STUDENT NAME</th>
                  <th className="py-3 px-4">ROLL NUMBER</th>
                  <th className="py-3 px-4 text-right">ACADEMIC HEALTH</th>
                  <th className="py-3 px-4 text-right">ATTENDANCE</th>
                  <th className="py-3 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-3 text-xs font-dmsans">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-ink-2">
                      No students enrolled in this course yet.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st) => (
                    <tr key={st.id} className="h-14 hover:bg-paper-1 transition-colors">
                      <td className="py-3 px-4">
                        <div
                          className={`w-2 h-2 ${
                            st.riskLevel === null
                              ? 'bg-paper-3'
                              : st.riskLevel === 'CRITICAL' || st.riskLevel === 'HIGH'
                              ? 'bg-burgundy'
                              : st.riskLevel === 'MEDIUM'
                              ? 'bg-mustard'
                              : 'bg-olive'
                          }`}
                        />
                      </td>
                      <td className="py-3 px-4 font-semibold text-ink-0">{st.name}</td>
                      <td className="py-3 px-4 font-mono text-ink-3">{st.rollNumber}</td>
                      <td className="py-3 px-4 text-right font-space font-bold text-ink-0">
                        {st.academicHealth !== null ? `${st.academicHealth}%` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-space text-ink-2">{st.attendance !== null ? `${st.attendance}%` : '—'}</td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/faculty/student/${st.id}`}
                          className="text-plum hover:underline font-mono text-[11px] font-semibold"
                        >
                          INSPECT &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <DeleteCourseButton courseId={course.id} />
        </>
      )}
    </div>
  );
}
