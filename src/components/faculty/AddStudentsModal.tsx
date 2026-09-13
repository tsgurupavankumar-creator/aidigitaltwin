'use client';

import { useState } from 'react';
import { UserPlus, ClipboardList } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

interface AddStudentsModalProps {
  open: boolean;
  onClose: () => void;
  courseId: string;
  courseName: string;
}

export function AddStudentsModal({ open, onClose, courseId, courseName }: AddStudentsModalProps) {
  const addStudentToCourse = useAppStore((s) => s.addStudentToCourse);
  const addStudentsToCourseBulk = useAppStore((s) => s.addStudentsToCourseBulk);

  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [singleName, setSingleName] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const reset = () => {
    setSingleName('');
    setBulkText('');
    setConfirmation(null);
    setMode('single');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAddSingle = () => {
    if (!singleName.trim()) return;
    addStudentToCourse(courseId, singleName.trim());
    setConfirmation(`Added "${singleName.trim()}" to ${courseName}.`);
    setSingleName('');
  };

  const handleAddBulk = () => {
    const names = bulkText
      .split('\n')
      .map((line) => line.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean);
    if (names.length === 0) return;
    const added = addStudentsToCourseBulk(courseId, names);
    setConfirmation(
      `Added ${added} student${added === 1 ? '' : 's'} to ${courseName}${
        names.length !== added ? ` (${names.length - added} already enrolled)` : ''
      }.`
    );
    setBulkText('');
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add Students"
      description={`Enroll students into ${courseName} one at a time, or paste a full class list.`}
    >
      <div className="space-y-4">
        <div className="flex bg-white/5 p-1 rounded-xl">
          <button
            onClick={() => {
              setMode('single');
              setConfirmation(null);
            }}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all',
              mode === 'single' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-white'
            )}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Single Student
          </button>
          <button
            onClick={() => {
              setMode('bulk');
              setConfirmation(null);
            }}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all',
              mode === 'bulk' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-white'
            )}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Paste Class List
          </button>
        </div>

        {mode === 'single' ? (
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Student Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSingle()}
                placeholder="Enter student name"
                className="flex-1 px-3 py-2.5 text-sm rounded-xl bg-[#0D111A] border border-white/10 focus:border-primary/50 outline-none transition-colors text-white placeholder:text-muted-foreground"
                autoFocus
              />
              <button
                onClick={handleAddSingle}
                disabled={!singleName.trim()}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
              >
                Add
              </button>
            </div>
          </div>
        ) : (
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              One name per line
            </label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={'Meera Iyer\nArjun Nair\nKavya Menon\n...'}
              rows={6}
              className="w-full px-3 py-2.5 text-sm rounded-xl bg-[#0D111A] border border-white/10 focus:border-primary/50 outline-none transition-colors text-white placeholder:text-muted-foreground resize-none font-mono"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleAddBulk}
                disabled={!bulkText.trim()}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
              >
                Add All
              </button>
            </div>
          </div>
        )}

        {confirmation && (
          <div className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-xl px-3 py-2">
            {confirmation}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium rounded-xl text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
