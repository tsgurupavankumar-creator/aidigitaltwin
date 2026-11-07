import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { ownedTopic, topicProgress, prerequisiteBlockers } from '@/lib/practice/access';
/** Recommends the next eligible practice tier based on the student's private mastery. */
export async function GET(req: NextRequest) {
  const auth = await requireRole('student');
  if ('error' in auth) return auth.error;
  if (process.env.PRACTICE_TIER_ENABLED !== 'true') return NextResponse.json({ error: 'Feature disabled' }, { status: 404 });
  const topicId = req.nextUrl.searchParams.get('syllabusTopicId') || '';
  const studentId = auth.user.student!.id;
  const topic = await ownedTopic(studentId, topicId);
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  const progress = await topicProgress(studentId, topicId);
  const blockers = await prerequisiteBlockers(studentId, topicId);
  return NextResponse.json({ topic: { id: topic.id, name: topic.name, levelTarget: topic.levelTarget }, ...progress, blockers: blockers || [] });
}
