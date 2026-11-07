import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/twin/access';
import { facultyTeachesStudent, whatIfResponse } from '@/lib/twin/twin-api';

type Ctx = { params: Promise<{ id: string }> };

/** Simulate a scenario for a student in one of the faculty member's courses (nothing is saved). */
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireUser('faculty');
  if (!auth.ok) return auth.error;
  const facultyId = auth.user.faculty?.id;
  const { id } = await ctx.params;
  if (!facultyId || !(await facultyTeachesStudent(facultyId, id))) {
    return NextResponse.json({ error: 'Student not found in your assigned courses' }, { status: 404 });
  }
  return whatIfResponse(`faculty:${facultyId}`, id, await req.json().catch(() => null));
}
