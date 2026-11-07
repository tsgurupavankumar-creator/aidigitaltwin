import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { SyllabusParseResultSchema } from '@/lib/validation/syllabus';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;

  const { topicId } = await params;
  if (!topicId || topicId.length > 128) {
    return NextResponse.json({ error: 'Invalid topic.' }, { status: 400 });
  }

  try {
    const selected = await prisma.syllabusTopic.findFirst({
      where: {
        id: topicId,
        module: { syllabus: { studentId: auth.user.student!.id } },
      },
      select: {
        module: {
          select: { syllabusId: true },
        },
      },
    });
    if (!selected) {
      return NextResponse.json({ error: 'This syllabus topic was not found in your account.' }, { status: 404 });
    }

    const syllabus = await prisma.courseSyllabus.findUnique({
      where: { id: selected.module.syllabusId },
      select: {
        id: true,
        courseId: true,
        course: { select: { name: true } },
        modules: {
          orderBy: { orderIndex: 'asc' },
          select: {
            name: true, description: true, orderIndex: true,
            topics: {
              orderBy: { orderIndex: 'asc' },
              select: { id: true, name: true, description: true, orderIndex: true },
            },
          },
        },
      },
    });
    if (!syllabus) {
      return NextResponse.json({ error: 'The syllabus no longer exists.' }, { status: 404 });
    }

    const topicIds: Record<string, string> = {};
    const modules = syllabus.modules.map((module) => ({
      name: module.name,
      description: module.description ?? undefined,
      orderIndex: module.orderIndex,
      topics: module.topics.map((topic) => {
        topicIds[`${module.orderIndex}:${topic.orderIndex}`] = topic.id;
        return {
          name: topic.name,
          description: topic.description ?? undefined,
          orderIndex: topic.orderIndex,
        };
      }),
    }));
    const parsed = SyllabusParseResultSchema.safeParse({ modules });
    if (!parsed.success) {
      return NextResponse.json({ error: 'The stored syllabus could not be loaded.' }, { status: 422 });
    }

    return NextResponse.json({
      courseId: syllabus.courseId,
      courseName: syllabus.course.name,
      syllabusId: syllabus.id,
      parsed: parsed.data,
      topicIds,
      selectedTopicId: topicId,
    });
  } catch (error) {
    console.error('[SYLLABUS_TOPIC_LOOKUP_FAILED]', error);
    return NextResponse.json({ error: 'Unable to load your syllabus topic.' }, { status: 500 });
  }
}
