'use client';

import { useRef, useState } from 'react';
import { Button, NoticeBox, inputClass, labelClass } from '@/components/twin/ui';
import { SyllabusParseResultSchema, SyllabusUploadRequestSchema } from '@/lib/validation/syllabus';
import type { SyllabusParseResult } from './types';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function SyllabusUploader({
  courseId,
  onUploadStart,
  onUploadSuccess,
  onUploadError,
  isUploading,
}: {
  courseId: string;
  onUploadStart: () => void;
  onUploadSuccess: (syllabusId: string, parsed: SyllabusParseResult, topicIds: Record<string, string>) => void;
  onUploadError: (message: string) => void;
  isUploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'parsing' | 'done'>('idle');
  const [notice, setNotice] = useState<{ kind: 'error'; text: string } | null>(null);

  const selectFile = (selected: File | undefined) => {
    setNotice(null);
    setFile(null);
    if (!selected) return;
    if (selected.type !== 'application/pdf') {
      setNotice({ kind: 'error', text: 'Choose a PDF file to continue.' });
      onUploadError('Choose a PDF file to continue.');
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setNotice({ kind: 'error', text: 'The PDF must be 10 MB or smaller.' });
      onUploadError('The PDF must be 10 MB or smaller.');
      return;
    }
    setFile(selected);
  };

  const upload = async () => {
    if (!file) return;
    const metadata = SyllabusUploadRequestSchema.safeParse({
      originalFileName: file.name,
      mimeType: file.type,
      fileSizeBytes: file.size,
    });
    if (!metadata.success) {
      const message = metadata.error.issues[0]?.message ?? 'Choose a valid PDF file.';
      setNotice({ kind: 'error', text: message });
      onUploadError(message);
      return;
    }

    onUploadStart();
    setNotice(null);
    setPhase('uploading');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('courseId', courseId);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // Upload progress and server-side parsing progress are separate states.
        // fetch doesn't expose upload-byte progress, so do not invent a percentage.
        const request = fetch('/api/student/syllabus/upload', { method: 'POST', body: formData });
        setPhase('parsing');
        const response = await request;
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = new Error(body.message || 'Upload or parsing failed.');
          if (attempt === 0 && (response.status === 503 || response.status >= 500)) continue;
          throw error;
        }
        const parsed = SyllabusParseResultSchema.safeParse(body.parsed);
        if (!parsed.success || typeof body.syllabusId !== 'string' || !body.topicIds || typeof body.topicIds !== 'object') {
          throw new Error('Invalid response from syllabus parser.');
        }
        setPhase('done');
        onUploadSuccess(body.syllabusId, parsed.data, body.topicIds as Record<string, string>);
        return;
      } catch (error) {
        if (attempt === 0 && error instanceof TypeError) continue;
        const message = error instanceof Error ? error.message : 'Network error. Please retry.';
        setPhase('idle');
        setNotice({ kind: 'error', text: message });
        onUploadError(message);
        return;
      }
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <label className={labelClass} htmlFor="syllabus-pdf">Course syllabus (PDF, max 10 MB)</label>
        <input
          ref={inputRef}
          id="syllabus-pdf"
          type="file"
          accept="application/pdf"
          disabled={isUploading}
          onChange={(event) => selectFile(event.currentTarget.files?.[0])}
          className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-paper-2 file:px-3 file:py-1.5 file:text-xs`}
        />
      </div>
      {phase !== 'idle' && <p role="status" aria-live="polite" className="text-sm text-ink-2">{phase === 'uploading' ? 'Uploading PDF…' : phase === 'parsing' ? 'Parsing your syllabus…' : 'Syllabus ready — continue to topics.'}</p>}
      {notice && <NoticeBox notice={notice} />}
      {file && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-paper-3 bg-paper-1 p-3 text-xs">
          <span className="min-w-0 truncate text-ink-1">
            {file.name} <span className="font-mono text-ink-3">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
          </span>
          <button
            type="button"
            disabled={isUploading}
            onClick={() => {
              setFile(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="font-mono text-ink-2 underline underline-offset-2 disabled:opacity-50"
          >
            Choose another file
          </button>
        </div>
      )}
      <Button onClick={upload} disabled={!file || isUploading}>
        {isUploading ? 'Processing…' : 'Upload syllabus'}
      </Button>
      {/* TODO(Veda): PDF preview / re-upload prompt / better errors */}
    </section>
  );
}
