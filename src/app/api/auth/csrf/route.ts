import { NextResponse } from 'next/server';
import { generateCsrfToken } from '@/lib/auth/csrf';

export async function GET() {
  const csrfToken = await generateCsrfToken();
  return NextResponse.json({ csrfToken });
}