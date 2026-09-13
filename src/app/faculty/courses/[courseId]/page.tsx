'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Copy, Check, RefreshCw, UserPlus, ArrowLeft, X, Search } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AddStudentsModal } from '@/components/faculty/AddStudentsModal';
import { useAppStore } from '@/lib/store';

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;

  const course = useAppStore((s) => s.courses.find((c) => c.id === courseId));
  const allStudents = useAppStore((s) => s.students);
  const regenerateCourseCode = useAppStore((s) => s.regenerateCourseCode);
  const removeStudentFromCourse = useAppStore((s) => s.removeStudentFromCourse);

  const [copied, setCopied] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  if (!course) {
    return (
      <div className="flex h-screen bg-[#07090F] overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto min-w-0">
          <Topbar title="Course Not Found" description="This course may have been deleted." />
          <main className="p-6 max-w-7xl mx-auto">
            <button
              onClick={() => router.push('/faculty/courses')}
              className="flex items-center gap-2 text-sm text-primary hover:text-secondary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Courses
            </button>
          </main>
        </div>
      </div>
    );
  }

  const roster = course.studentIds
    .map((id) => allStudents.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const atRisk = roster.filter((s) => s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL').length;
  const avgHealth = roster.length
    ? Math.round(roster.reduce((sum, s) => sum + s.academicHealth, 0) / roster.length)
    : 0;
  const avgAttendance = roster.length
    ? Math.round(roster.reduce((sum, s) => sum + s.attendance, 0) / roster.length)
    : 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(course.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRegenerate = () => {
    regenerateCourseCode(course.id);
    setRegenerating(true);
    setTimeout(() => setRegenerating(false), 600);
  };

  return (
    <div className="flex h-screen bg-[#07090F] overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0">
        <Topbar title={course.name} description={`${course.subject}${course.section ? ` · ${course.section}` : ''} · ${course.term}`} />
        <main className="p-6 space-y-6 max-w-7xl mx-auto">
          <button
            onClick={() => router.push('/faculty/courses')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Courses
          </button>

          {/* Join code panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-[#111722] border border-white/5 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <h3 className="text-sm font-medium text-white mb-1">Student Join Code</h3>
              <p className="text-xs text-muted-foreground">
                Share this code so students can enroll themselves in {course.name}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-lg font-mono font-bold text-white bg-white/5 px-4 py-2 rounded-xl border border-white/10 tracking-wider">
                {course.code}
              </code>
              <button
                onClick={handleCopy}
                className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-muted-foreground hover:text-white"
                title="Copy join code"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={handleRegenerate}
                className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-muted-foreground hover:text-white"
                title="Generate a new code"
              >
                <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </motion.div>

          {/* Metric summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Enrolled Students', value: roster.length, color: 'text-white' },
              { label: 'Avg Academic Health', value: `${avgHealth}%`, color: 'text-emerald-400' },
              { label: 'Avg Attendance', value: `${avgAttendance}%`, color: 'text-cyan-400' },
              { label: 'At Risk', value: atRisk, color: atRisk > 0 ? 'text-red-400' : 'text-emerald-400' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.08 }}
                className="p-4 rounded-2xl bg-[#111722] border border-white/5 text-center"
              >
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Roster */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-[#111722] border border-white/5 p-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-sm font-medium text-white">Course Roster</h3>
                <p className="text-xs text-muted-foreground">Students enrolled in {course.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search roster..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 text-sm rounded-xl bg-[#0D111A] border border-white/10 focus:border-primary/50 outline-none transition-colors w-48 text-white placeholder:text-muted-foreground"
                  />
                </div>
                <button
                  onClick={() => setAddOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Students
                </button>
              </div>
            </div>

            {roster.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                {course.studentIds.length === 0
                  ? 'No students enrolled yet. Share the join code above, or add students manually.'
                  : 'No students match your search.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-white/5">
                      <th className="py-3 px-3 font-medium">Student</th>
                      <th className="py-3 px-3 font-medium">Health</th>
                      <th className="py-3 px-3 font-medium">Risk Level</th>
                      <th className="py-3 px-3 font-medium">Attendance</th>
                      <th className="py-3 px-3 font-medium">Last Activity</th>
                      <th className="py-3 px-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((student, index) => (
                      <motion.tr
                        key={student.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary/30 to-secondary/30 flex items-center justify-center font-bold text-xs text-white border border-white/10">
                              {student.name.split(' ').map((n) => n[0]).join('')}
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
                                  background:
                                    student.academicHealth < 50
                                      ? '#EF4444'
                                      : student.academicHealth < 70
                                      ? '#F59E0B'
                                      : '#10B981',
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
                        <td className="py-3.5 px-3 text-xs text-muted-foreground">
                          {student.lastActivity || 'Today'}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <button
                            onClick={() => removeStudentFromCourse(course.id, student.id)}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 font-medium transition-colors"
                            title="Remove from course"
                          >
                            <X className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </main>
      </div>

      <AddStudentsModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        courseId={course.id}
        courseName={course.name}
      />
    </div>
  );
}
