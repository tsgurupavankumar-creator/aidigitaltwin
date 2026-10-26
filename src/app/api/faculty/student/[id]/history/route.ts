import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/twin/access';
import { facultyTeachesStudent, historyResponse } from '@/lib/twin/twin-api';

type Ctx = { params: Promise<{ id: string }> };

/** The student's twin over time (latest 60 updates, oldest first). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireUser('faculty');
  if (!auth.ok) return auth.error;
  const facultyId = auth.user.faculty?.id;
  const { id } = await ctx.params;
  if (!facultyId || !(await facultyTeachesStudent(facultyId, id))) {
    return NextResponse.json({ error: 'Student not found in your assigned courses' }, { status: 404 });
  }
  return historyResponse(id);
}
