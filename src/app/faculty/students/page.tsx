'use client';

import { useAppStore } from '@/lib/store';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { Search, Filter, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export default function ClassIntelligencePage() {
  const students = useAppStore((s) => s.students);
  const searchTerm = useAppStore((s) => s.searchTerm);
  const setSearchTerm = useAppStore((s) => s.setSearchTerm);
  const riskFilter = useAppStore((s) => s.selectedRiskFilter);
  const setRiskFilter = useAppStore((s) => s.setRiskFilter);

  const filteredStudents = students.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.id.includes(searchTerm);
    const matchRisk = riskFilter === 'All' || s.riskLevel === riskFilter.toUpperCase();
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
            placeholder="Search student name or ID..."
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
                riskFilter === r ? 'bg-plum text-paper-0 font-semibold' : 'bg-paper-1 text-ink-2 hover:text-ink-0'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Editorial Spreadsheet Table */}
      <div className="bg-paper-0 border border-paper-3 rounded-md overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-paper-3 bg-paper-1 text-[11px] font-mono uppercase tracking-widest text-ink-3">
              <th className="py-3.5 px-4">STATUS</th>
              <th className="py-3.5 px-4">STUDENT NAME</th>
              <th className="py-3.5 px-4">ROLL / ID</th>
              <th className="py-3.5 px-4 text-right">HEALTH</th>
              <th className="py-3.5 px-4 text-right">ATTENDANCE</th>
              <th className="py-3.5 px-4 text-right">ENGAGEMENT</th>
              <th className="py-3.5 px-4 text-right">GPA</th>
              <th className="py-3.5 px-4 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-paper-3 text-xs font-dmsans">
            {filteredStudents.map((st) => (
              <tr key={st.id} className="h-14 hover:bg-paper-1 transition-colors">
                <td className="py-3 px-4">
                  <div
                    className={`w-2 h-2 ${
                      st.riskLevel === 'CRITICAL' || st.riskLevel === 'HIGH'
                        ? 'bg-burgundy'
                        : st.riskLevel === 'MEDIUM'
                        ? 'bg-mustard'
                        : 'bg-olive'
                    }`}
                  />
                </td>
                <td className="py-3 px-4 font-semibold text-ink-0">{st.name}</td>
                <td className="py-3 px-4 font-mono text-ink-3">{st.id}</td>
                <td className="py-3 px-4 text-right font-space font-bold text-ink-0">{st.academicHealth}%</td>
                <td className="py-3 px-4 text-right font-space text-ink-2">{st.attendance}%</td>
                <td className="py-3 px-4 text-right font-space text-ink-2">{st.engagement}%</td>
                <td className="py-3 px-4 text-right font-space text-ink-0">{st.gpa}</td>
                <td className="py-3 px-4 text-right">
                  <Link
                    href={`/faculty/student/${st.id}`}
                    className="text-plum hover:underline font-mono text-[11px] font-semibold"
                  >
                    DRILL DOWN &rarr;
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
