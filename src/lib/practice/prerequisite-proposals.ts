/** Safe graph check: adding target -> required must not create a dependency cycle. */
export function createsPrerequisiteCycle(
  topics: { id: string; prerequisiteIds: string[] }[],
  target: string,
  required: string,
): boolean {
  if (target === required) return true;
  const graph = new Map(topics.map(t => [t.id, t.prerequisiteIds]));
  if (!graph.has(target) || !graph.has(required)) return true;
  const seen = new Set<string>();
  const stack = [required];
  while (stack.length) {
    const current = stack.pop()!;
    if (current === target) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of graph.get(current) ?? []) stack.push(next);
  }
  return false;
}
