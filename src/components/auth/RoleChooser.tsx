'use client';

import Link from 'next/link';
import { ArrowRight, GraduationCap, UsersRound } from 'lucide-react';
import { motion } from 'framer-motion';

export function RoleChooser() {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col items-center justify-center">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-terracotta text-sm font-bold text-paper-0">
          AT
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3">Secure learning system</p>
        <h1 className="mt-3 font-instrument text-[2.75rem] leading-none text-ink-0">How would you like to sign in?</h1>
      </div>

      <div className="grid w-full gap-5 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
          <Link href="/login/student" className="group block h-full rounded-[12px] border border-paper-3 bg-paper-1 p-7 transition-colors hover:border-terracotta hover:bg-paper-0">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta">Student access</span>
              <GraduationCap className="h-5 w-5 text-terracotta" />
            </div>
            <div className="space-y-3">
              <h2 className="font-fraunces text-3xl text-ink-0">Student</h2>
              <p className="text-[15px] leading-6 text-ink-2">Access your digital twin, study plan, performance trends, and personalized guidance.</p>
            </div>
            <div className="mt-8 flex items-center justify-between border-t border-paper-3 pt-4 text-[11px] font-mono uppercase tracking-[0.12em] text-terracotta">
              <span>Continue</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut', delay: 0.05 }}>
          <Link href="/login/faculty" className="group block h-full rounded-[12px] border border-paper-3 bg-paper-1 p-7 transition-colors hover:border-plum hover:bg-paper-0">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-plum">Faculty access</span>
              <UsersRound className="h-5 w-5 text-plum" />
            </div>
            <div className="space-y-3">
              <h2 className="font-fraunces text-3xl text-ink-0">Faculty</h2>
              <p className="text-[15px] leading-6 text-ink-2">Manage classroom intelligence, monitor insights, and oversee student outcomes securely.</p>
            </div>
            <div className="mt-8 flex items-center justify-between border-t border-paper-3 pt-4 text-[11px] font-mono uppercase tracking-[0.12em] text-plum">
              <span>Continue</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
