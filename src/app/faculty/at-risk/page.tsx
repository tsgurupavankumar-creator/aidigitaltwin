'use client';

import { useEffect, useState } from 'react';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { AlertTriangle, ArrowRight, ShieldAlert, Loader2, RotateCcw, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { formatGpaRange } from '@/lib/format/gpa-range';

interface AtRiskStudent {
  id: string;
  rollNumber: string;
  name: string;
  department: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  predictedGpa: string;
  academicHealth: number;
  attendance: number;
  lastActivity: string;
  courses: string[];
}

export default function AtRiskStudentsPage() {
  const [students, setStudents] = useState<AtRiskStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAtRisk = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/faculty/at-risk');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load at-risk students');
      setStudents(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load at-risk cohort');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAtRisk();
  }, []);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="space-y-2">
        <span className="font-mono text-xs text-burgundy uppercase tracking-widest font-medium">
          01 / PRIORITY ACADEMIC INTERVENTION
        </span>
        <h1 className="font-baskerville italic font-normal text-4xl text-ink-0">
          At-Risk Cohort Monitoring
        </h1>
        <p className="text-sm text-ink-2 font-dmsans">
          Students displaying negative learning velocity vectors, critical attendance degradation, or elevated risk assessments.
        </p>
      </div>

      <HairlineRule variant="accent" className="bg-burgundy" />

      {loading ? (
        <div className="p-16 rounded-md bg-paper-0 border border-paper-3 flex flex-col items-center justify-center gap-3 text-ink-2">
          <Loader2 className="w-8 h-8 animate-spin text-burgundy" />
          <span className="font-mono text-xs uppercase tracking-wider">Evaluating multi-agent risk vectors...</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-md bg-burgundy/10 border border-burgundy/20 space-y-3">
          <p className="text-sm font-semibold text-burgundy">{error}</p>
          <button
            onClick={fetchAtRisk}
            className="px-3 py-1.5 text-xs font-mono rounded bg-burgundy text-paper-0 hover:bg-[#8B2635] transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : students.length === 0 ? (
        <div className="p-16 rounded-md bg-paper-0 border border-paper-3 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-olive mx-auto" />
          <h3 className="font-semibold text-ink-0 text-sm">No At-Risk Students Detected</h3>
          <p className="text-xs text-ink-2">All enrolled students currently meet the required attendance and academic velocity standards.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {students.map((student) => (
            <div key={student.id} className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-inter font-bold text-base text-ink-0">{student.name}</h3>
                  <span className="font-mono text-xs text-ink-3">
                    Roll: {student.rollNumber} {student.courses.length ? `• ${student.courses.join(', ')}` : ''}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                    student.riskLevel === 'CRITICAL'
                      ? 'bg-burgundy text-paper-0'
                      : student.riskLevel === 'HIGH'
                      ? 'bg-mustard text-paper-0'
                      : 'bg-paper-2 text-ink-1'
                  }`}
                >
                  {student.riskLevel} RISK ({student.riskScore}%)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center p-3 rounded bg-paper-1 border border-paper-3 font-space">
                <div>
                  <span className="font-mono text-[10px] text-ink-3 block">HEALTH</span>
                  <span className="font-bold text-sm text-burgundy">{student.academicHealth}%</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-ink-3 block">ATTENDANCE</span>
                  <span className="font-bold text-sm text-ink-0">{student.attendance}%</span>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-ink-3 block">PREDICTED GPA</span>
                  <span className="font-bold text-sm text-ink-0">{formatGpaRange(Number(student.predictedGpa))}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-paper-3 flex justify-between items-center text-xs">
                <span className="text-ink-3 font-mono">{student.lastActivity}</span>
                <Link
                  href={`/faculty/student/${student.id}`}
                  className="text-plum hover:underline font-semibold font-mono text-[11px] flex items-center gap-1"
                >
                  <span>INSPECT & DISPATCH</span>
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
