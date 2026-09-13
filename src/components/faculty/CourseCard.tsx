'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users, Copy, Check, MoreVertical, Trash2 } from 'lucide-react';
import { Course } from '@/lib/types';
import { useAppStore } from '@/lib/store';

interface CourseCardProps {
  course: Course;
  index: number;
}

export function CourseCard({ course, index }: CourseCardProps) {
  const deleteCourse = useAppStore((s) => s.deleteCourse);
  const students = useAppStore((s) => s.students);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  const atRiskCount = course.studentIds.filter((id) => {
    const student = students.find((s) => s.id === id);
    return student && (student.riskLevel === 'HIGH' || student.riskLevel === 'CRITICAL');
  }).length;

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(course.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirmDelete) {
      deleteCourse(course.id);
    } else {
      setConfirmDelete(true);
      setMenuOpen(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Link href={`/faculty/courses/${course.id}`}>
        <div className="group relative rounded-2xl bg-[#111722] border border-white/5 p-5 card-hover cursor-pointer h-full flex flex-col">
          <div
            className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
            style={{ background: course.color }}
          />

          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">{course.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {course.subject}
                {course.section ? ` · ${course.section}` : ''}
              </p>
            </div>
            <div className="relative flex-shrink-0" ref={menuRef}>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-white"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuOpen && (
                <div
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="absolute right-0 top-8 z-10 w-40 rounded-xl bg-[#0D111A] border border-white/10 shadow-xl py-1"
                >
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Course
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] text-muted-foreground">Join Code</span>
            <code className="text-xs font-mono font-semibold text-white bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
              {course.code}
            </code>
            <button
              onClick={handleCopy}
              className="p-1 rounded-md hover:bg-white/10 transition-colors text-muted-foreground hover:text-white"
              title="Copy join code"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>

          <div className="mt-auto flex items-center justify-between pt-3 border-t border-white/5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span className="font-medium text-white">{course.studentIds.length}</span>
              <span>students</span>
            </div>
            {atRiskCount > 0 && (
              <span className="text-[11px] font-medium text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full border border-red-400/20">
                {atRiskCount} at risk
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">{course.term}</span>
          </div>

          {confirmDelete && (
            <div
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="absolute inset-0 rounded-2xl bg-[#0D111A]/95 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-4 z-20"
            >
              <p className="text-xs text-center text-white">
                Delete <span className="font-semibold">{course.name}</span>? This can&apos;t be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirmDelete(false);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
