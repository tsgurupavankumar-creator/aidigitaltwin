import { NextResponse } from 'next/server';
import { z } from 'zod';
import { RecordError } from './records';

/** Same error shape for every twin data route: 400 for bad input, RecordError's own status, 500 otherwise. */
export async function handle(label: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid request', issues: error.issues.slice(0, 20) }, { status: 400 });
    }
    if (error instanceof RecordError) {
      return NextResponse.json({ error: error.message, ...(error.details ? { details: error.details } : {}) }, { status: error.status });
    }
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
    console.error(`[${label}]`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must be YYYY-MM-DD');
export const cuid = z.string().min(1).max(64);
