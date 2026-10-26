'use client';

import { useEffect, useState } from 'react';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { Search, Filter, ArrowUpRight, Loader2, RotateCcw, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { formatGpaRange } from '@/lib/format/gpa-range';

interface FacultyStudentRow {
  id: string;
  rollNumber: string;
  fullName: string;
  department: string;
  year: number;
  semester: number;
  riskAssessments: Array<{ riskLevel: string; riskScore: number; predictedGPA: number | null }>;
  digitalTwin: {
    academicHealth: number;
    attendanceScore: number;
    engagementScore: number;
  } | null;
}

export default function ClassIntelligencePage() {
  const [students, setStudents] = useState<FacultyStudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');

  const fetchStudents = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/faculty/students');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load student roster');
      setStudents(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load student roster');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const filteredStudents = students.filter((s) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      s.fullName.toLowerCase().includes(term) ||
      s.rollNumber.toLowerCase().includes(term) ||
      s.id.toLowerCase().includes(term);

    const latestRisk = s.riskAssessments[0]?.riskLevel || 'LOW';
    const matchRisk = riskFilter === 'All' || latestRisk.toUpperCase() === riskFilter.toUpperCase();
    return matchSearch && matchRisk;
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="space-y-2">
        <span className="font-mono text-xs text-plum uppercase tracking-widest font-medium">
          01 / COHORT DIRECTORY
        </span>
        <h1 className="font-baskerville italic font-normal text-4xl text-ink-0">
          Class Intelligence Telemetry
        </h1>
        <p className="text-sm text-ink-2 font-dmsans">
          Comprehensive roster of enrolled students with cognitive health metrics and risk trajectory scores.
        </p>
      </div>

      <HairlineRule variant="plum" />

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search student name or roll number..."
            className="w-full pl-9 pr-3 py-2 text-xs font-dmsans bg-paper-0 border border-paper-3 rounded text-ink-0 placeholder:text-ink-3 outline-none focus:border-plum"
          />
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-ink-3 uppercase">RISK FILTER:</span>
          {['All', 'Low', 'Medium', 'High', 'Critical'].map((r) => (
            <button
              key={r}
              onClick={() => setRiskFilter(r)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                riskFilter.toUpperCase() === r.toUpperCase()
                  ? 'bg-plum text-paper-0 font-semibold'
                  : 'bg-paper-1 text-ink-2 hover:text-ink-0'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-16 rounded-md bg-paper-0 border border-paper-3 flex flex-col items-center justify-center gap-3 text-ink-2">
          <Loader2 className="w-8 h-8 animate-spin text-plum" />
          <span className="font-mono text-xs uppercase tracking-wider">Loading enrolled cohort roster...</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-md bg-burgundy/10 border border-burgundy/20 space-y-3">
          <p className="text-sm font-semibold text-burgundy">{error}</p>
          <button
            onClick={fetchStudents}
            className="px-3 py-1.5 text-xs font-mono rounded bg-plum text-paper-0 hover:bg-plum/90 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : students.length === 0 ? (
        <div className="p-16 rounded-md bg-paper-0 border border-paper-3 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-olive mx-auto" />
          <h3 className="font-semibold text-ink-0 text-sm">No Students Enrolled</h3>
          <p className="text-xs text-ink-2">There are no students currently enrolled in your assigned courses.</p>
        </div>
      ) : (
        /* Editorial Spreadsheet Table */
        <div className="bg-paper-0 border border-paper-3 rounded-md overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-paper-3 bg-paper-1 text-[11px] font-mono uppercase tracking-widest text-ink-3">
                <th className="py-3.5 px-4">STATUS</th>
                <th className="py-3.5 px-4">STUDENT NAME</th>
                <th className="py-3.5 px-4">ROLL NUMBER</th>
                <th className="py-3.5 px-4 text-right">HEALTH</th>
                <th className="py-3.5 px-4 text-right">ATTENDANCE</th>
                <th className="py-3.5 px-4 text-right">ENGAGEMENT</th>
                <th className="py-3.5 px-4 text-right">PREDICTED GPA</th>
                <th className="py-3.5 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-3 text-xs font-dmsans">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-ink-2">
                    No students match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => {
                  const riskLevel = st.riskAssessments[0]?.riskLevel || 'LOW';
                  const predictedGpa = st.riskAssessments[0]?.predictedGPA
                    ? formatGpaRange(st.riskAssessments[0].predictedGPA)
                    : formatGpaRange(3.65);

                  return (
                    <tr key={st.id} className="h-14 hover:bg-paper-1 transition-colors">
                      <td className="py-3 px-4">
                        <div
                          className={`w-2 h-2 ${
                            riskLevel === 'CRITICAL' || riskLevel === 'HIGH'
                              ? 'bg-burgundy'
                              : riskLevel === 'MEDIUM'
                              ? 'bg-mustard'
                              : 'bg-olive'
                          }`}
                        />
                      </td>
                      <td className="py-3 px-4 font-semibold text-ink-0">{st.fullName}</td>
                      <td className="py-3 px-4 font-mono text-ink-3">{st.rollNumber}</td>
                      <td className="py-3 px-4 text-right font-space font-bold text-ink-0">
                        {st.digitalTwin ? `${Math.round(st.digitalTwin.academicHealth)}%` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-space text-ink-2">
                        {st.digitalTwin ? `${Math.round(st.digitalTwin.attendanceScore)}%` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-space text-ink-2">
                        {st.digitalTwin ? `${Math.round(st.digitalTwin.engagementScore)}%` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-space font-bold text-ink-0">
                        {predictedGpa}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/faculty/student/${st.id}`}
                          className="text-plum hover:underline font-mono text-[11px] font-semibold"
                        >
                          DRILL DOWN &rarr;
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
