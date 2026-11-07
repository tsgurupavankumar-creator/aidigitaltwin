'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { WhyPanel, type Explanation } from '@/components/twin/WhyPanel';
import { TwinExplorer } from '@/components/twin/TwinExplorer';
import { ArrowLeft, Send, Loader2, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { formatGpaRange } from '@/lib/format/gpa-range';

const pctOrDash = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}%`);

interface StudentDrillDown {
  id: string;
  rollNumber: string;
  name: string;
  department: string;
  academicHealth: number | null;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  riskScore: number | null;
  attendance: number | null;
  engagement: number | null;
  learningVelocity: number | null;
  predictedGpa: number | null;
  markRange: { low: number; high: number } | null;
  assessedAt: string | null;
  factors: Record<string, unknown>;
  explanation: Explanation;
}

export default function StudentDrillDownPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params?.id as string;

  const [student, setStudent] = useState<StudentDrillDown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStudent = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/faculty/student/${studentId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load student drilldown');
      setStudent(json.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the student');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) fetchStudent();
  }, [studentId]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <Link
        href="/faculty/students"
        className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-ink-3 hover:text-ink-0 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Roster
      </Link>

      {loading ? (
        <div className="p-16 rounded-md bg-paper-0 border border-paper-3 flex flex-col items-center justify-center gap-3 text-ink-2">
          <Loader2 className="w-8 h-8 animate-spin text-plum" />
          <span className="font-mono text-xs uppercase tracking-wider">Loading student…</span>
        </div>
      ) : error || !student ? (
        <div className="p-6 rounded-md bg-burgundy/10 border border-burgundy/20 space-y-3">
          <p className="text-sm font-semibold text-burgundy">{error || 'Student not found in your assigned courses'}</p>
          <button
            onClick={fetchStudent}
            className="px-3 py-1.5 text-xs font-mono rounded bg-plum text-paper-0 hover:bg-plum/90 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : (
        <div className="p-8 rounded-md bg-paper-0 border border-paper-3 space-y-6">
          <div className="flex items-center justify-between pb-6 border-b border-paper-3">
            <div>
              <span className="font-mono text-xs text-plum uppercase tracking-widest font-medium block">
                STUDENT PROFILE DRILLDOWN
              </span>
              <h2 className="font-baskerville italic text-3xl text-ink-0 mt-1">{student.name}</h2>
              <p className="font-mono text-xs text-ink-3">
                ROLL: {student.rollNumber} • {student.department}
              </p>
            </div>

            <span
              className={`text-xs font-mono px-3 py-1 rounded font-semibold uppercase ${
                student.riskLevel === 'CRITICAL' || student.riskLevel === 'HIGH'
                  ? 'bg-burgundy text-paper-0'
                  : student.riskLevel === 'MEDIUM'
                  ? 'bg-mustard text-paper-0'
                  : 'bg-olive text-paper-0'
              }`}
            >
              {student.riskLevel ? `${student.riskLevel} RISK (${student.riskScore}%)` : 'NOT ASSESSED YET'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-space">
            <div className="p-4 rounded bg-paper-1 border border-paper-3">
              <span className="font-mono text-[10px] text-ink-3 block uppercase">HEALTH</span>
              <p className="font-bold text-xl text-plum mt-1">{pctOrDash(student.academicHealth)}</p>
            </div>
            <div className="p-4 rounded bg-paper-1 border border-paper-3">
              <span className="font-mono text-[10px] text-ink-3 block uppercase">ATTENDANCE</span>
              <p className="font-bold text-xl text-ink-0 mt-1">{pctOrDash(student.attendance)}</p>
            </div>
            <div className="p-4 rounded bg-paper-1 border border-paper-3">
              <span className="font-mono text-[10px] text-ink-3 block uppercase">ENGAGEMENT</span>
              <p className="font-bold text-xl text-ink-0 mt-1">{pctOrDash(student.engagement)}</p>
            </div>
            <div className="p-4 rounded bg-paper-1 border border-paper-3">
              <span className="font-mono text-[10px] text-ink-3 block uppercase">GPA TRAJECTORY</span>
              <p className="font-bold text-xl text-olive mt-1">
                {formatGpaRange(student.predictedGpa, student.markRange)}
              </p>
            </div>
          </div>

          <TwinExplorer whatIfEndpoint={`/api/faculty/student/${studentId}/what-if`} historyEndpoint={`/api/faculty/student/${studentId}/history`} audience="faculty" />

          <WhyPanel explanation={student.explanation} configSource={typeof student.factors?.configSource === 'string' ? student.factors.configSource : undefined} />

          {student.explanation?.summary && (
            <div className="p-4 rounded bg-paper-1 border border-paper-3 text-xs text-ink-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-3 block mb-1">
                LATEST ASSESSMENT SUMMARY
              </span>
              <p>{student.explanation.summary}</p>
            </div>
          )}

          <div className="p-4 rounded bg-plum-light border border-plum/20 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-ink-0 font-dmsans">Faculty Action Recommended</p>
              <p className="text-xs text-ink-2">Dispatch targeted concept drill or schedule office hours block.</p>
            </div>
            <button
              onClick={() => router.push('/faculty/interventions')}
              className="px-4 py-2 text-xs font-semibold rounded-sm bg-plum text-paper-0 hover:bg-plum/90 transition-colors flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Create intervention</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
