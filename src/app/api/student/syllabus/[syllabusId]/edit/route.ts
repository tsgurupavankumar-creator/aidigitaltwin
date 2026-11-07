import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { SyllabusEditSchema } from '@/lib/validation/practice';
type Ctx = { params: Promise<{ syllabusId: string }> };
/** Safely edits only topics/modules belonging to the authenticated student's syllabus. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;
  if (process.env.PRACTICE_TIER_ENABLED !== 'true') return NextResponse.json({ error: 'Feature disabled' }, { status: 404 });
  const { syllabusId } = await ctx.params;
  const studentId = auth.user.student!.id;
  const body = SyllabusEditSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Invalid edit' }, { status: 400 });
  const modules = body.data.modules || [], topics = body.data.topics || [];
  try {
    await prisma.$transaction(async tx => {
      const syllabus = await tx.courseSyllabus.findFirst({ where: { id: syllabusId, studentId }, select: { id: true } });
      if (!syllabus) throw new Error('NOT_FOUND');
      for (const m of modules) {
        const updated = await tx.syllabusModule.updateMany({ where: { id: m.id, syllabusId }, data: { name: m.name, estimatedMinutes: m.estimatedMinutes, parseConfidence: 1 } });
        if (updated.count !== 1) throw new Error('NOT_FOUND');
      }
      for (const t of topics) {
        const updated = await tx.syllabusTopic.updateMany({ where: { id: t.id, module: { syllabusId } },
          data: { name: t.name, description: t.description, estimatedMinutes: t.estimatedMinutes, levelTarget: t.levelTarget, parseConfidence: 1 } });
        if (updated.count !== 1) throw new Error('NOT_FOUND');
      }
      await tx.agentLog.create({ data: { studentId, agentType: 'QUIZ', status: 'COMPLETED',
        triggeredBy: 'student:syllabus_edit', input: { action: 'MANUAL_EDIT', syllabusId },
        output: { moduleIds: modules.map(x => x.id), topicIds: topics.map(x => x.id) } } });
    });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Syllabus edit failed or referenced invalid items' }, { status: 404 }); }
}
