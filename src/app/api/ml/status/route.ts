import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';

/** Is the ML service up, with both models loaded? Signed-in users only; cached 30 s. */
let cache: { at: number; body: { online: boolean; modelsLoaded: boolean } } | null = null;

export async function GET() {
  if (!(await getAuthSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (cache && Date.now() - cache.at < 30_000) return NextResponse.json(cache.body);
  const base = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
  let body = { online: false, modelsLoaded: false };
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2500), cache: 'no-store' });
    if (res.ok) {
      const h = await res.json();
      body = { online: true, modelsLoaded: !!(h.learning_model_loaded && h.attendance_model_loaded) };
    }
  } catch { /* offline */ }
  cache = { at: Date.now(), body };
  return NextResponse.json(body);
}
