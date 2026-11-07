import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;
import { z } from 'zod';
import { parseCsv, requireHeaders } from './csv';

/**
 * Concept management for a course: concepts (with an optional topic), difficulty 1-5, and
 * prerequisite links ("Joins needs Keys"). The knowledge-gap agent follows these links, so
 * the prerequisite graph must stay acyclic.
 */
export const conceptInput = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  topic: z.string().trim().max(120).optional().nullable(),
  difficulty: z.number().int().min(1).max(5),
  prerequisiteIds: z.array(z.string().min(1).max(64)).max(30).default([]),
});
export type ConceptInput = z.infer<typeof conceptInput>;

export class ConceptError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

/** Would adding `prereqId -> conceptId` edges create a cycle? edges: [prerequisiteId, dependentId] */
export function createsCycle(conceptId: string, prereqIds: string[], edges: Array<[string, string]>): string | null {
  const needs = new Map<string, string[]>();          // dependent -> its prerequisites
  for (const [p, d] of edges) if (d !== conceptId) needs.set(d, [...(needs.get(d) ?? []), p]);
  needs.set(conceptId, [...prereqIds]);
  // A cycle exists if, starting from any new prerequisite, we can walk prerequisites back to conceptId.
  for (const start of prereqIds) {
    if (start === conceptId) return start;
    const seen = new Set<string>();
    const stack = [start];
    while (stack.length) {
      const c = stack.pop()!;
      if (c === conceptId) return start;
      if (seen.has(c)) continue;
      seen.add(c);
      stack.push(...(needs.get(c) ?? []));
    }
  }
  return null;
}

async function topicId(db: Db, courseId: string, name: string | null | undefined) {
  if (!name) return null;
  const existing = await db.topic.findFirst({ where: { courseId, name }, select: { id: true } });
  if (existing) return existing.id;
  const count = await db.topic.count({ where: { courseId } });
  return (await db.topic.create({ data: { courseId, name, orderIndex: count } })).id;
}

async function checkPrerequisites(db: Db, courseId: string, conceptId: string, prereqIds: string[]) {
  const unique = [...new Set(prereqIds)];
  if (!unique.length) return unique;
  const found = await db.concept.count({ where: { courseId, id: { in: unique } } });
  if (found !== unique.length) throw new ConceptError('Prerequisites must be concepts of this course.');
  const edges = await db.conceptEdge.findMany({
    where: { dependent: { courseId } },
    select: { prerequisiteId: true, dependentId: true },
  });
  const loop = createsCycle(conceptId, unique, edges.map((e) => [e.prerequisiteId, e.dependentId]));
  if (loop) throw new ConceptError('That would create a circular prerequisite (a concept cannot depend on itself, directly or indirectly).');
  return unique;
}

export async function listConcepts(db: Db, courseId: string) {
  const concepts = await db.concept.findMany({
    where: { courseId },
    orderBy: { orderIndex: 'asc' },
    select: {
      id: true, name: true, difficulty: true, orderIndex: true,
      parentTopic: { select: { name: true } },
      prerequisites: { select: { prerequisiteId: true } },
      _count: { select: { questions: true, masteryRecords: true } },
    },
  });
  return concepts.map((c) => ({
    id: c.id, name: c.name, difficulty: c.difficulty, topic: c.parentTopic?.name ?? null,
    prerequisiteIds: c.prerequisites.map((p) => p.prerequisiteId),
    questionCount: c._count.questions, masteryCount: c._count.masteryRecords,
  }));
}

export async function createConcept(db: Db, courseId: string, input: ConceptInput) {
  if (await db.concept.findFirst({ where: { courseId, name: input.name }, select: { id: true } })) {
    throw new ConceptError(`A concept called "${input.name}" already exists in this course.`, 409);
  }
  const count = await db.concept.count({ where: { courseId } });
  const created = await db.concept.create({
    data: { courseId, name: input.name, difficulty: input.difficulty, orderIndex: count, parentTopicId: await topicId(db, courseId, input.topic) },
    select: { id: true },
  });
  const prereqs = await checkPrerequisites(db, courseId, created.id, input.prerequisiteIds);
  if (prereqs.length) await db.conceptEdge.createMany({ data: prereqs.map((p) => ({ prerequisiteId: p, dependentId: created.id })) });
  return created;
}

export async function updateConcept(db: Db, courseId: string, conceptId: string, input: ConceptInput) {
  const concept = await db.concept.findFirst({ where: { id: conceptId, courseId }, select: { id: true } });
  if (!concept) throw new ConceptError('Concept not found in this course.', 404);
  const clash = await db.concept.findFirst({ where: { courseId, name: input.name, NOT: { id: conceptId } }, select: { id: true } });
  if (clash) throw new ConceptError(`A concept called "${input.name}" already exists in this course.`, 409);
  const prereqs = await checkPrerequisites(db, courseId, conceptId, input.prerequisiteIds);
  await db.concept.update({
    where: { id: conceptId },
    data: { name: input.name, difficulty: input.difficulty, parentTopicId: await topicId(db, courseId, input.topic) },
  });
  await db.conceptEdge.deleteMany({ where: { dependentId: conceptId } });
  if (prereqs.length) await db.conceptEdge.createMany({ data: prereqs.map((p) => ({ prerequisiteId: p, dependentId: conceptId })) });
}

/** Refuses when quiz questions or student mastery depend on the concept (deleting would erase them). */
export async function deleteConcept(db: Db, courseId: string, conceptId: string) {
  const concept = await db.concept.findFirst({
    where: { id: conceptId, courseId },
    select: { id: true, _count: { select: { questions: true, masteryRecords: true } } },
  });
  if (!concept) throw new ConceptError('Concept not found in this course.', 404);
  if (concept._count.questions || concept._count.masteryRecords) {
    throw new ConceptError(`This concept is used by ${concept._count.questions} quiz question(s) and ${concept._count.masteryRecords} student mastery record(s); deleting it would erase them. Rename it instead.`, 409);
  }
  await db.concept.delete({ where: { id: conceptId } });
}

/**
 * CSV import: name, topic, difficulty, prerequisites (names separated by ";", optional).
 * All-or-nothing; rows may refer to concepts defined later in the same file.
 */
export async function importConcepts(db: Db, courseId: string, csv: string) {
  const table = parseCsv(csv);
  requireHeaders(table, ['name', 'difficulty']);
  const rows = table.rows.map((r, i) => {
    const line = i + 2;
    const name = (r.name ?? '').trim();
    const difficulty = Number(r.difficulty);
    if (!name) throw new ConceptError(`Row ${line}: name is required.`);
    if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) throw new ConceptError(`Row ${line}: difficulty must be a whole number from 1 to 5.`);
    const prereqs = (r.prerequisites ?? '').split(';').map((x) => x.trim()).filter(Boolean);
    return { line, name, difficulty, topic: (r.topic ?? '').trim() || null, prereqs };
  });
  const names = new Set<string>();
  for (const r of rows) {
    if (names.has(r.name.toLowerCase())) throw new ConceptError(`Row ${r.line}: "${r.name}" appears twice.`);
    names.add(r.name.toLowerCase());
  }
  const existing = await db.concept.findMany({ where: { courseId }, select: { id: true, name: true } });
  const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c.id]));
  for (const r of rows) for (const p of r.prereqs) {
    if (!byName.has(p.toLowerCase()) && !names.has(p.toLowerCase())) throw new ConceptError(`Row ${r.line}: prerequisite "${p}" is not a concept in this course or this file.`);
  }
  let created = 0, updated = 0;
  for (const r of rows) {
    const id = byName.get(r.name.toLowerCase());
    if (id) {
      await db.concept.update({ where: { id }, data: { difficulty: r.difficulty, parentTopicId: await topicId(db, courseId, r.topic) } });
      updated += 1;
    } else {
      const c = await db.concept.create({
        data: { courseId, name: r.name, difficulty: r.difficulty, orderIndex: existing.length + created, parentTopicId: await topicId(db, courseId, r.topic) },
        select: { id: true },
      });
      byName.set(r.name.toLowerCase(), c.id);
      created += 1;
    }
  }
  // Edges after all concepts exist; checked for cycles one concept at a time.
  for (const r of rows) {
    if (!r.prereqs.length) continue;
    const id = byName.get(r.name.toLowerCase())!;
    const prereqIds = await checkPrerequisites(db, courseId, id, r.prereqs.map((p) => byName.get(p.toLowerCase())!))
      .catch((e) => { throw new ConceptError(`Row ${r.line}: ${e.message}`); });
    await db.conceptEdge.deleteMany({ where: { dependentId: id } });
    await db.conceptEdge.createMany({ data: prereqIds.map((p) => ({ prerequisiteId: p, dependentId: id })) });
  }
  return { rows: rows.length, created, updated };
}
