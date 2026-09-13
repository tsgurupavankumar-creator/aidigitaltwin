'use client';

import { ReactNode, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, description, children, maxWidth = 'max-w-md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'relative w-full rounded-2xl bg-[#111722] border border-white/10 shadow-2xl shadow-black/40 p-6 max-h-[90vh] overflow-y-auto',
              maxWidth
            )}
          >
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-base font-semibold text-white">{title}</h2>
              <button
                onClick={onClose}
                className="p-1.5 -mr-1.5 -mt-1 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {description && <p className="text-xs text-muted-foreground mb-5">{description}</p>}
            {!description && <div className="mb-4" />}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
