'use client';

import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { StatusBadge } from '../ui/StatusBadge';

interface StudentTableProps {
  filterAtRiskOnly?: boolean;
}

export function StudentTable({ filterAtRiskOnly = false }: StudentTableProps) {
  const { students, searchTerm, setSearchTerm, selectedRiskFilter, setRiskFilter } = useAppStore();

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterAtRiskOnly
      ? (s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL')
      : (selectedRiskFilter === 'All' || s.riskLevel === selectedRiskFilter);
    return matchesSearch && matchesFilter;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#111722] border border-white/5 p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-sm font-medium">
            {filterAtRiskOnly ? 'Priority At-Risk Roster' : 'Student Roster'}
          </h3>
          <p className="text-xs text-muted-foreground">Detailed intelligence for individual student digital twins</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm rounded-xl bg-[#0D111A] border border-white/10 focus:border-primary/50 outline-none transition-colors w-48 text-white placeholder:text-muted-foreground"
            />
          </div>
          {!filterAtRiskOnly && (
            <select
              value={selectedRiskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl bg-[#0D111A] border border-white/10 focus:border-primary/50 outline-none transition-colors text-white"
            >
              <option value="All">All Risks</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-white/5">
              <th className="py-3 px-3 font-medium">Student</th>
              <th className="py-3 px-3 font-medium">Health</th>
              <th className="py-3 px-3 font-medium">Risk Level</th>
              <th className="py-3 px-3 font-medium">Attendance</th>
              <th className="py-3 px-3 font-medium">Performance</th>
              <th className="py-3 px-3 font-medium">Gaps</th>
              <th className="py-3 px-3 font-medium">Last Activity</th>
              <th className="py-3 px-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student, index) => (
              <motion.tr
                key={student.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="border-b border-white/5 hover:bg-white/5 transition-colors"
              >
                <td className="py-3.5 px-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary/30 to-secondary/30 flex items-center justify-center font-bold text-xs text-white border border-white/10">
                      {student.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white block">{student.name}</span>
                      <span className="text-[10px] text-muted-foreground">{student.id}</span>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${student.academicHealth}%`,
                          background: student.academicHealth < 50 ? '#EF4444' : student.academicHealth < 70 ? '#F59E0B' : '#10B981',
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold">{student.academicHealth}%</span>
                  </div>
                </td>
                <td className="py-3.5 px-3">
                  <StatusBadge status={student.riskLevel} />
                </td>
                <td className="py-3.5 px-3 text-sm font-medium">{student.attendance}%</td>
                <td className="py-3.5 px-3 text-sm font-medium">{student.performance || 80}%</td>
                <td className="py-3.5 px-3 text-sm font-semibold text-amber-400">{student.gaps || 2}</td>
                <td className="py-3.5 px-3 text-xs text-muted-foreground">{student.lastActivity || 'Today'}</td>
                <td className="py-3.5 px-3 text-right">
                  <button className="text-xs text-primary hover:text-secondary font-medium transition-colors">
                    Inspect Twin →
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>

        {filteredStudents.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No students found matching current search criteria.
          </div>
        )}
      </div>
    </motion.div>
  );
}
