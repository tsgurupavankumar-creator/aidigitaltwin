'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '../ui/Modal';
import { useAppStore } from '@/lib/store';

interface CreateCourseModalProps {
  open: boolean;
  onClose: () => void;
}

const SUBJECT_OPTIONS = [
  'Computer Science',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'History',
  'Economics',
  'Other',
];

export function CreateCourseModal({ open, onClose }: CreateCourseModalProps) {
  const router = useRouter();
  const createCourse = useAppStore((s) => s.createCourse);

  const [name, setName] = useState('');
  const [subject, setSubject] = useState(SUBJECT_OPTIONS[0]);
  const [section, setSection] = useState('');
  const [term, setTerm] = useState('Fall 2026');
  const [schedule, setSchedule] = useState('');
  const [error, setError] = useState('');

  const reset = () => {
    setName('');
    setSubject(SUBJECT_OPTIONS[0]);
    setSection('');
    setTerm('Fall 2026');
    setSchedule('');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Course name is required.');
      return;
    }
    if (!term.trim()) {
      setError('Term is required.');
      return;
    }
    const course = createCourse({
      name: name.trim(),
      subject,
      section: section.trim() || undefined,
      term: term.trim(),
      schedule: schedule.trim() || undefined,
    });
    reset();
    onClose();
    router.push(`/faculty/courses/${course.id}`);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Create a New Course"
      description="Set up a course and get a shareable join code for your students."
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">
            Course Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            placeholder="e.g. Database Management Systems"
            className="w-full px-3 py-2.5 text-sm rounded-xl bg-[#0D111A] border border-white/10 focus:border-primary/50 outline-none transition-colors text-white placeholder:text-muted-foreground"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl bg-[#0D111A] border border-white/10 focus:border-primary/50 outline-none transition-colors text-white"
            >
              {SUBJECT_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Section (optional)</label>
            <input
              type="text"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="e.g. Section A"
              className="w-full px-3 py-2.5 text-sm rounded-xl bg-[#0D111A] border border-white/10 focus:border-primary/50 outline-none transition-colors text-white placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              Term <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setError('');
              }}
              placeholder="e.g. Fall 2026"
              className="w-full px-3 py-2.5 text-sm rounded-xl bg-[#0D111A] border border-white/10 focus:border-primary/50 outline-none transition-colors text-white placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Schedule (optional)</label>
            <input
              type="text"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="e.g. Mon/Wed 10:00"
              className="w-full px-3 py-2.5 text-sm rounded-xl bg-[#0D111A] border border-white/10 focus:border-primary/50 outline-none transition-colors text-white placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium rounded-xl text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
          >
            Create Course
          </button>
        </div>
      </div>
    </Modal>
  );
}
