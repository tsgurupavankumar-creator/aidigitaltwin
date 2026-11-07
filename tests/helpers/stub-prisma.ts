/** Import FIRST in a test file to keep the real Prisma client (and its engine) from loading. */
import { FakeDb } from './fake-db';

export const fakeDb = new FakeDb();
const id = require.resolve('../../src/lib/prisma');
require.cache[id] = { id, filename: id, loaded: true, exports: { prisma: fakeDb }, children: [], paths: [], path: '' } as unknown as NodeJS.Module;
