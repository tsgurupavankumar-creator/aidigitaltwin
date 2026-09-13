'use client';

import { useAppStore } from '@/lib/store';
import { HairlineRule } from '@/components/ui/HairlineRule';
import { GraduationCap, Users, Plus, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function CoursesPage() {
  const courses = useAppStore((s) => s.courses);

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {courses.map((course) => (
          <div key={course.id} className="p-6 rounded-md bg-paper-0 border border-paper-3 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="px-2 py-0.5 rounded bg-plum-light text-plum font-semibold border border-plum/20">
                  {course.code}
                </span>
                <span className="text-ink-3">{course.term}</span>
              </div>
              <h3 className="font-inter font-bold text-xl text-ink-0">{course.name}</h3>
              <p className="text-xs text-ink-2">Section: {course.section || '01'} • Schedule: {course.schedule || 'MWF 10:00 AM'}</p>
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
    </div>
  );
}
