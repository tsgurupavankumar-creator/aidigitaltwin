'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { ArrowLeft, Send } from 'lucide-react';
import Link from 'next/link';
import { HairlineRule } from '@/components/ui/HairlineRule';

export default function StudentDrillDownPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params?.id as string;
  const students = useAppStore((s) => s.students);

  const student = students.find((s) => s.id === studentId) || {
    id: studentId,
    name: 'Aarav Sharma',
    academicHealth: 84,
    riskLevel: 'LOW' as const,
    attendance: 92,
    engagement: 78,
    learningVelocity: 85,
    gpa: 3.8,
    predictedGpa: 3.9,
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <Link
        href="/faculty/students"
        className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-ink-3 hover:text-ink-0 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Roster
      </Link>

      <div className="p-8 rounded-md bg-paper-0 border border-paper-3 space-y-6">
        <div className="flex items-center justify-between pb-6 border-b border-paper-3">
          <div>
            <span className="font-mono text-xs text-plum uppercase tracking-widest font-medium block">
              STUDENT PROFILE DRILLDOWN
            </span>
            <h2 className="font-baskerville italic text-3xl text-ink-0 mt-1">{student.name}</h2>
            <p className="font-mono text-xs text-ink-3">ROLL / ID: {student.id}</p>
          </div>

          <span className={`text-xs font-mono px-3 py-1 rounded font-semibold uppercase ${
            student.riskLevel === 'CRITICAL' || student.riskLevel === 'HIGH'
              ? 'bg-burgundy text-paper-0'
              : 'bg-olive text-paper-0'
          }`}>
            {student.riskLevel} RISK STATUS
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-space">
          <div className="p-4 rounded bg-paper-1 border border-paper-3">
            <span className="font-mono text-[10px] text-ink-3 block uppercase">HEALTH</span>
            <p className="font-bold text-xl text-plum mt-1">{student.academicHealth}%</p>
          </div>
          <div className="p-4 rounded bg-paper-1 border border-paper-3">
            <span className="font-mono text-[10px] text-ink-3 block uppercase">ATTENDANCE</span>
            <p className="font-bold text-xl text-ink-0 mt-1">{student.attendance}%</p>
          </div>
          <div className="p-4 rounded bg-paper-1 border border-paper-3">
            <span className="font-mono text-[10px] text-ink-3 block uppercase">ENGAGEMENT</span>
            <p className="font-bold text-xl text-ink-0 mt-1">{student.engagement}%</p>
          </div>
          <div className="p-4 rounded bg-paper-1 border border-paper-3">
            <span className="font-mono text-[10px] text-ink-3 block uppercase">GPA TRAJECTORY</span>
            <p className="font-bold text-xl text-olive mt-1">{student.gpa} &rarr; {student.predictedGpa}</p>
          </div>
        </div>

        <div className="p-4 rounded bg-plum-light border border-plum/20 flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-ink-0 font-dmsans">Faculty Action Required</p>
            <p className="text-xs text-ink-2">Dispatch targeted concept drill or schedule office hours block.</p>
          </div>
          <button
            onClick={() => router.push('/faculty/interventions')}
            className="px-4 py-2 text-xs font-semibold rounded-sm bg-plum text-paper-0 hover:bg-plum/90 transition-colors flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Dispatch Directive</span>
          </button>
        </div>
      </div>
    </div>
  );
}
