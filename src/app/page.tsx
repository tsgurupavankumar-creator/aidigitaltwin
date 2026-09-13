import Link from 'next/link';
import { ArrowRight, GraduationCap, UsersRound } from 'lucide-react';
import { PaperTexture } from '@/components/ui/PaperTexture';

export default function RootPage() {
  return (
    <PaperTexture className="min-h-screen bg-paper-0 text-ink-0 font-inter select-none">
      <header className="border-b border-paper-3 px-6 py-5 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-terracotta text-xs font-bold text-paper-0">
              AT
            </div>
            <div>
              <span className="block font-fraunces text-lg leading-none text-ink-0">AI Academic Digital Twin</span>
              <span className="mt-1 block text-[10px] font-mono uppercase tracking-[0.18em] text-ink-3">Secure learning system</span>
            </div>
          </div>

          <div className="hidden items-center gap-4 text-xs font-mono text-ink-2 sm:flex">
            <span>Academic year 2025–26</span>
            <span className="text-paper-3">|</span>
            <Link href="/login/student" className="font-semibold text-terracotta hover:underline">Student Login</Link>
            <Link href="/login/faculty" className="font-semibold text-plum hover:underline">Faculty Login</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col items-center justify-center px-6 py-16 sm:py-24">
        <div className="max-w-3xl text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3">Academic intelligence platform</p>
          <h1 className="mt-5 font-instrument text-[3.25rem] leading-none text-ink-0 sm:text-[4.5rem]">
            A clear view of academic performance.
          </h1>
          <p className="mt-6 text-lg leading-8 text-ink-2">
            Personalized study guidance for students and classroom intelligence for faculty, all in a secure system designed for modern institutions.
          </p>
        </div>

        <div className="mt-12 grid w-full max-w-4xl gap-6 md:grid-cols-2">
          <Link href="/login/student" className="group rounded-[12px] border border-paper-3 bg-paper-1 p-8 text-left transition-colors hover:border-terracotta hover:bg-paper-0">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta">Student access</span>
              <GraduationCap className="h-5 w-5 text-terracotta" />
            </div>
            <h2 className="font-fraunces text-3xl text-ink-0">Student Login</h2>
            <p className="mt-3 text-[15px] leading-6 text-ink-2">Track your progress, uncover learning gaps, and follow a tailored academic path.</p>
            <div className="mt-8 flex items-center justify-between border-t border-paper-3 pt-4 text-[11px] font-mono uppercase tracking-[0.12em] text-terracotta">
              <span>Continue</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link href="/login/faculty" className="group rounded-[12px] border border-paper-3 bg-paper-1 p-8 text-left transition-colors hover:border-plum hover:bg-paper-0">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-plum">Faculty access</span>
              <UsersRound className="h-5 w-5 text-plum" />
            </div>
            <h2 className="font-fraunces text-3xl text-ink-0">Faculty Login</h2>
            <p className="mt-3 text-[15px] leading-6 text-ink-2">Monitor outcomes, review risk signals, and guide intervention strategies with clarity.</p>
            <div className="mt-8 flex items-center justify-between border-t border-paper-3 pt-4 text-[11px] font-mono uppercase tracking-[0.12em] text-plum">
              <span>Continue</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </main>

      <footer className="border-t border-paper-3 px-8 py-6 text-center text-xs font-mono text-ink-3">
        © 2026 AI Academic Digital Twin
      </footer>
    </PaperTexture>
  );
}
