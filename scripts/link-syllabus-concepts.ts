import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const studentId = process.argv[2];

  if (!studentId) {
    throw new Error('Provide a student database ID.');
  }

  const syllabi = await prisma.courseSyllabus.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, courseId: true, version: true }
  });

  const latestByCourse = new Map<string, typeof syllabi[number]>();

  for (const syllabus of syllabi) {
    if (!latestByCourse.has(syllabus.courseId)) {
      latestByCourse.set(syllabus.courseId, syllabus);
    }
  }

  let linked = 0;
  let created = 0;

  for (const syllabus of latestByCourse.values()) {
    const modules = await prisma.syllabusModule.findMany({
      where: { syllabusId: syllabus.id },
      select: { id: true }
    });

    const topics = await prisma.syllabusTopic.findMany({
      where: { moduleId: { in: modules.map(m => m.id) } },
      select: { id: true, name: true, conceptId: true }
    });

    let nextOrder = await prisma.concept.count({
      where: { courseId: syllabus.courseId }
    });

    for (const topic of topics) {
      if (topic.conceptId) continue;

      const name = topic.name.trim();

      if (!name || name.length > 120) {
        console.log('Skipped invalid topic:', topic.id);
        continue;
      }

      const existing = await prisma.concept.findUnique({
        where: {
          courseId_name: {
            courseId: syllabus.courseId,
            name
          }
        },
        select: { id: true }
      });

      const concept = existing ?? await prisma.concept.create({
        data: {
          courseId: syllabus.courseId,
          name,
          difficulty: 3,
          orderIndex: nextOrder++
        },
        select: { id: true }
      });

      if (!existing) created++;

      await prisma.syllabusTopic.update({
        where: { id: topic.id },
        data: { conceptId: concept.id }
      });

      linked++;
    }

    console.log(
      `Syllabus version ${syllabus.version}: ${topics.length} topics inspected`
    );
  }

  console.log(`Linked ${linked} topics.`);
  console.log(`Created ${created} course concepts.`);
}

main()
  .catch(error => {
    console.error('Linking failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
