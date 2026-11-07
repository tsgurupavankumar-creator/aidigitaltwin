import test from 'node:test';
import assert from 'node:assert/strict';
import { createsCycle, createConcept, deleteConcept, importConcepts, listConcepts, updateConcept, ConceptError } from '../src/lib/twin/concepts';

/** Minimal in-memory stand-in for the Prisma calls the concept service makes. */
function fakeDb() {
  let n = 0;
  const id = (p: string) => `${p}${++n}`;
  const t = { concept: [] as any[], topic: [] as any[], edge: [] as any[], question: [] as any[], mastery: [] as any[] };
  const match = (row: any, where: any = {}): boolean => Object.entries(where).every(([k, v]: [string, any]) => {
    if (k === 'NOT') return !match(row, v);
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    return row[k] === v;
  });
  const db: any = {
    concept: {
      findFirst: async ({ where, select }: any) => {
        const c = t.concept.find((r) => match(r, where));
        if (!c) return null;
        return select?._count ? { ...c, _count: { questions: t.question.filter((q) => q.conceptId === c.id).length, masteryRecords: t.mastery.filter((m) => m.conceptId === c.id).length } } : { ...c };
      },
      findMany: async ({ where }: any) => t.concept.filter((r) => match(r, where)).sort((a, b) => a.orderIndex - b.orderIndex).map((c) => ({
        ...c, parentTopic: c.parentTopicId ? { name: t.topic.find((x) => x.id === c.parentTopicId)?.name } : null,
        prerequisites: t.edge.filter((e) => e.dependentId === c.id).map((e) => ({ prerequisiteId: e.prerequisiteId })),
        _count: { questions: t.question.filter((q) => q.conceptId === c.id).length, masteryRecords: t.mastery.filter((m) => m.conceptId === c.id).length },
      })),
      count: async ({ where }: any) => t.concept.filter((r) => match(r, where)).length,
      create: async ({ data }: any) => { const r = { id: id('c'), ...data }; t.concept.push(r); return { id: r.id }; },
      update: async ({ where, data }: any) => Object.assign(t.concept.find((r) => r.id === where.id), data),
      delete: async ({ where }: any) => { t.concept = t.concept.filter((r) => r.id !== where.id); t.edge = t.edge.filter((e) => e.prerequisiteId !== where.id && e.dependentId !== where.id); },
    },
    topic: {
      findFirst: async ({ where }: any) => t.topic.find((r) => match(r, where)) ?? null,
      count: async ({ where }: any) => t.topic.filter((r) => match(r, where)).length,
      create: async ({ data }: any) => { const r = { id: id('t'), ...data }; t.topic.push(r); return r; },
    },
    conceptEdge: {
      findMany: async () => t.edge.map((e) => ({ prerequisiteId: e.prerequisiteId, dependentId: e.dependentId })),
      createMany: async ({ data }: any) => { t.edge.push(...data); return { count: data.length }; },
      deleteMany: async ({ where }: any) => { t.edge = t.edge.filter((e) => e.dependentId !== where.dependentId); },
    },
  };
  return { db, t };
}

test('cycle check: direct, indirect and self-loops are refused; a normal chain is fine', () => {
  const edges: Array<[string, string]> = [['A', 'B'], ['B', 'C']];          // B needs A, C needs B
  assert.equal(createsCycle('A', ['C'], edges), 'C', 'A needs C, but C needs B needs A');
  assert.equal(createsCycle('A', ['A'], edges), 'A', 'self-loop');
  assert.equal(createsCycle('D', ['C'], edges), null, 'D needs C: fine');
  assert.equal(createsCycle('B', ['A'], edges), null, 're-saving an existing link is fine');
});

test('create, edit and list: topic created once, prerequisites stored, cycles refused through the service', async () => {
  const { db, t } = fakeDb();
  const keys = await createConcept(db, 'k1', { name: 'Keys', topic: 'Relational model', difficulty: 2, prerequisiteIds: [] });
  const joins = await createConcept(db, 'k1', { name: 'SQL Joins', topic: 'SQL', difficulty: 3, prerequisiteIds: [keys.id] });
  await createConcept(db, 'k1', { name: 'Views', topic: 'SQL', difficulty: 2, prerequisiteIds: [joins.id] });
  assert.equal(t.topic.length, 2, 'SQL topic reused');
  await assert.rejects(updateConcept(db, 'k1', keys.id, { name: 'Keys', topic: null, difficulty: 2, prerequisiteIds: [joins.id] }), /circular/);
  await assert.rejects(createConcept(db, 'k1', { name: 'Keys', topic: null, difficulty: 1, prerequisiteIds: [] }), /already exists/);
  const list = await listConcepts(db, 'k1');
  assert.deepEqual(list.find((c) => c.name === 'SQL Joins')!.prerequisiteIds, [keys.id]);
  assert.equal(list.find((c) => c.name === 'SQL Joins')!.topic, 'SQL');
});

test('delete refuses a concept used by quiz questions or student mastery (it would erase them)', async () => {
  const { db, t } = fakeDb();
  const c = await createConcept(db, 'k1', { name: 'Keys', topic: null, difficulty: 2, prerequisiteIds: [] });
  t.question.push({ conceptId: c.id });
  await assert.rejects(deleteConcept(db, 'k1', c.id), (e: unknown) => e instanceof ConceptError && e.status === 409);
  t.question.length = 0;
  await deleteConcept(db, 'k1', c.id);
  assert.equal(t.concept.length, 0);
});

test('CSV import: forward references work; bad rows are refused before anything is written', async () => {
  const { db, t } = fakeDb();
  const r = await importConcepts(db, 'k1', 'name,topic,difficulty,prerequisites\nNormalization,Design,4,Keys; SQL Joins\nKeys,Relational model,2,\nSQL Joins,SQL,3,Keys\n');
  assert.deepEqual([r.rows, r.created, r.updated], [3, 3, 0]);
  const norm = t.concept.find((c) => c.name === 'Normalization')!;
  assert.equal(t.edge.filter((e) => e.dependentId === norm.id).length, 2);
  const { db: db2, t: t2 } = fakeDb();
  await assert.rejects(importConcepts(db2, 'k1', 'name,difficulty,prerequisites\nA,2,Missing\n'), /not a concept/);
  await assert.rejects(importConcepts(db2, 'k1', 'name,difficulty\nA,9\n'), /1 to 5/);
  await assert.rejects(importConcepts(db2, 'k1', 'name,difficulty\nA,2\na,3\n'), /twice/);
  assert.equal(t2.concept.length, 0, 'nothing written for invalid files');
});
