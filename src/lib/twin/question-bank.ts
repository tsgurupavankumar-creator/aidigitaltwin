/**
 * Real questions for the seeded concepts (three per concept: one for each
 * seeded quiz). Used by prisma/seed.ts and scripts/fix-seeded-quizzes.ts, which
 * replaces the old placeholder questions (choices A-D, answer always "A").
 */
export interface BankQuestion { prompt: string; choices: string[]; answer: string }

export const QUESTION_BANK: Record<string, BankQuestion[]> = {
  Normalization: [
    { prompt: 'A table is in 2NF when it is in 1NF and…', choices: ['no non-key attribute depends on part of a composite key', 'it has no NULL values', 'every column is indexed', 'it has a single-column primary key only'], answer: 'no non-key attribute depends on part of a composite key' },
    { prompt: 'Which normal form removes transitive dependencies?', choices: ['3NF', '1NF', '2NF', '4NF'], answer: '3NF' },
    { prompt: 'The main goal of normalization is to…', choices: ['reduce redundancy and update anomalies', 'make queries faster in every case', 'remove all foreign keys', 'store data in one table'], answer: 'reduce redundancy and update anomalies' },
  ],
  Transactions: [
    { prompt: 'Which ACID property guarantees that a committed change survives a crash?', choices: ['Durability', 'Atomicity', 'Consistency', 'Isolation'], answer: 'Durability' },
    { prompt: 'Atomicity means a transaction…', choices: ['happens completely or not at all', 'runs faster than other transactions', 'can never be rolled back', 'locks the whole database'], answer: 'happens completely or not at all' },
    { prompt: 'Which statement undoes the changes of the current transaction?', choices: ['ROLLBACK', 'COMMIT', 'SAVE', 'GRANT'], answer: 'ROLLBACK' },
  ],
  SQL: [
    { prompt: 'Which clause filters groups after GROUP BY?', choices: ['HAVING', 'WHERE', 'ORDER BY', 'LIMIT'], answer: 'HAVING' },
    { prompt: 'Which join returns only rows that match in both tables?', choices: ['INNER JOIN', 'LEFT JOIN', 'FULL OUTER JOIN', 'CROSS JOIN'], answer: 'INNER JOIN' },
    { prompt: 'COUNT(*) counts…', choices: ['all rows, including rows with NULLs', 'only non-NULL values of one column', 'distinct rows only', 'columns in the table'], answer: 'all rows, including rows with NULLs' },
  ],
  Indexing: [
    { prompt: 'Most relational databases implement ordinary indexes as…', choices: ['B+ trees', 'linked lists', 'stacks', 'bitmaps only'], answer: 'B+ trees' },
    { prompt: 'An index usually makes which operation slower?', choices: ['INSERT', 'SELECT by the indexed column', 'ORDER BY the indexed column', 'joining on the indexed column'], answer: 'INSERT' },
    { prompt: 'A clustered index determines…', choices: ['the physical order of rows', 'the number of columns', 'which users can read the table', 'the backup schedule'], answer: 'the physical order of rows' },
  ],
  'ER Model': [
    { prompt: 'In an ER diagram, a diamond represents…', choices: ['a relationship', 'an entity', 'an attribute', 'a primary key'], answer: 'a relationship' },
    { prompt: 'A weak entity is one that…', choices: ['cannot be identified by its own attributes alone', 'has no attributes', 'has exactly one instance', 'is never stored'], answer: 'cannot be identified by its own attributes alone' },
    { prompt: 'A many-to-many relationship is usually implemented with…', choices: ['a junction (associative) table', 'a single foreign key', 'a view', 'a trigger'], answer: 'a junction (associative) table' },
  ],
  Deadlocks: [
    { prompt: 'Which is NOT one of the four Coffman conditions for deadlock?', choices: ['Preemption', 'Mutual exclusion', 'Hold and wait', 'Circular wait'], answer: 'Preemption' },
    { prompt: "The Banker's algorithm is used for deadlock…", choices: ['avoidance', 'detection only', 'recovery', 'ignorance'], answer: 'avoidance' },
    { prompt: 'Ordering all resources and requesting them in order prevents…', choices: ['circular wait', 'mutual exclusion', 'starvation in all cases', 'paging'], answer: 'circular wait' },
  ],
  'Memory Management': [
    { prompt: 'Paging removes which problem?', choices: ['external fragmentation', 'internal fragmentation', 'thrashing', 'page faults'], answer: 'external fragmentation' },
    { prompt: 'The TLB is a cache for…', choices: ['page table entries', 'disk blocks', 'CPU registers', 'file names'], answer: 'page table entries' },
    { prompt: 'Thrashing happens when…', choices: ['the system spends more time paging than executing', 'the CPU is idle', 'memory is never full', 'there is only one process'], answer: 'the system spends more time paging than executing' },
  ],
  Scheduling: [
    { prompt: 'Which algorithm minimises average waiting time when burst times are known?', choices: ['Shortest Job First', 'First Come First Served', 'Round Robin', 'Random'], answer: 'Shortest Job First' },
    { prompt: 'Round Robin scheduling uses a…', choices: ['time quantum', 'priority queue only', 'deadline', 'lottery ticket'], answer: 'time quantum' },
    { prompt: 'Priority scheduling can cause starvation; the usual fix is…', choices: ['aging', 'paging', 'swapping', 'spooling'], answer: 'aging' },
  ],
  'File Systems': [
    { prompt: 'An inode stores…', choices: ['a file’s metadata and block pointers', 'the file name only', 'the whole directory tree', 'the CPU schedule'], answer: 'a file’s metadata and block pointers' },
    { prompt: 'Which allocation method has no external fragmentation and allows direct access?', choices: ['Indexed allocation', 'Contiguous allocation', 'Linked allocation', 'None of these'], answer: 'Indexed allocation' },
    { prompt: 'Journaling file systems mainly improve…', choices: ['recovery after a crash', 'read speed', 'file name length', 'compression'], answer: 'recovery after a crash' },
  ],
  'Process Sync': [
    { prompt: 'A critical-section solution must provide mutual exclusion, progress and…', choices: ['bounded waiting', 'preemption', 'paging', 'deadlock'], answer: 'bounded waiting' },
    { prompt: 'A semaphore’s wait (P) operation…', choices: ['decrements it and may block', 'always increments it', 'reads it without changing it', 'deletes it'], answer: 'decrements it and may block' },
    { prompt: 'Which classic problem involves a shared bounded buffer?', choices: ['Producer–consumer', "Dining philosophers", 'Readers–writers', 'Sleeping barber'], answer: 'Producer–consumer' },
  ],
};

/** The bank question for a concept and quiz number (0, 1, 2…); null when the concept has none. */
export function bankQuestion(conceptName: string, quizIndex: number): BankQuestion | null {
  const list = QUESTION_BANK[conceptName];
  if (!list?.length) return null;
  const q = list[quizIndex % list.length];
  // The bank lists the answer first for readability; rotate the choices by a
  // fixed amount derived from the question so its position varies (and is stable).
  const shift = [...q.prompt].reduce((a, ch) => a + ch.charCodeAt(0), 0) % q.choices.length;
  return { ...q, choices: [...q.choices.slice(shift), ...q.choices.slice(0, shift)] };
}

/** True for the old seeded placeholder: bare choices A-D and answer "A". */
export function isPlaceholderQuestion(options: unknown, correctAnswer: string): boolean {
  return Array.isArray(options) && options.join(',') === 'A,B,C,D' && correctAnswer === 'A';
}
