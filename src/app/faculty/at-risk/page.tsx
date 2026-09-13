'use client';

import { useAppStore } from '@/lib/store';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function AtRiskStudentsPage() {
  const students = useAppStore((s) => s.students);
  const atRiskList = students.filter((s) => s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL' || s.riskLevel === 'MEDIUM');

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
          Students displaying negative learning velocity vectors or critical attendance degradation.
        </p>
      </div>

      <HairlineRule variant="accent" className="bg-burgundy" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {atRiskList.map((student) => (
          <div key={student.id} className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-inter font-bold text-base text-ink-0">{student.name}</h3>
                <span className="font-mono text-xs text-ink-3">Roll / ID: {student.id}</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                student.riskLevel === 'CRITICAL' ? 'bg-burgundy text-paper-0' : 'bg-mustard text-paper-0'
              }`}>
                {student.riskLevel} RISK
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
                <span className="font-bold text-sm text-ink-0">{student.predictedGpa}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-paper-3 flex justify-between items-center text-xs">
              <span className="text-ink-3 font-mono">Last Active: {student.lastActivity || 'Yesterday'}</span>
              <Link
                href={`/faculty/student/${student.id}`}
                className="text-plum hover:underline font-semibold font-mono text-[11px] flex items-center gap-1"
              >
                <span>DISPATCH INTERVENTION</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
