import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export async function GET() {
  const auth = await requireRole('faculty');
  if ('error' in auth) return auth.error;

  try {
    const facultyId = auth.user.faculty!.id;

    // Get courses taught by this faculty
    const courses = await prisma.course.findMany({
      where: { facultyId },
      include: {
        concepts: {
          include: {
            masteryRecords: {
              select: { masteryScore: true, studentId: true },
            },
          },
        },
      },
    });

    const gapList: Array<{
      id: string;
      concept: string;
      subject: string;
      courseCode: string;
      mastery: number;
      strugglingStudentsCount: number;
      totalAssessed: number;
      difficulty: number;
    }> = [];

    for (const course of courses) {
      for (const concept of course.concepts) {
        const scores = concept.masteryRecords.map((m) => m.masteryScore);
        const avg = scores.length
          ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
          : 60;
        const struggling = scores.filter((s) => s < 70).length;

        gapList.push({
          id: concept.id,
          concept: concept.name,
          subject: course.name,
          courseCode: course.code,
          mastery: avg,
          strugglingStudentsCount: struggling,
          totalAssessed: scores.length,
          difficulty: concept.difficulty,
        });
      }
    }

    // Sort by lowest mastery first (highest deficit)
    gapList.sort((a, b) => a.mastery - b.mastery);

    return NextResponse.json({ data: gapList });
  } catch (error) {
    console.error('[FACULTY_KNOWLEDGE_GAPS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch knowledge gap heatmap' }, { status: 500 });
  }
}
