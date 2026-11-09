/** Course code → the codes it requires, within one curriculum. */
export type PrerequisiteGraph = ReadonlyMap<string, readonly string[]>;

/**
 * The cycle that setting `course`'s prerequisites to `prerequisites` would create, or null.
 * The graph is the curriculum's current one; `course`'s own current edges are replaced.
 * A cycle is returned as a path that starts and ends at `course`: ['A', 'B', 'C', 'A'] means
 * A requires B, B requires C and C requires A. A self-loop is ['A', 'A'].
 * Deterministic: prerequisites are tried in code order, so the same input names the same cycle.
 */
export function findPrerequisiteCycle(graph: PrerequisiteGraph, course: string, prerequisites: readonly string[]): string[] | null {
  const next = (code: string): readonly string[] => (code === course ? prerequisites : (graph.get(code) ?? []));
  const sorted = (codes: readonly string[]) => [...codes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  // Depth-first from course; the first path back to course is the cycle. Only cycles through
  // course are new: the graph had none before (every earlier write was checked the same way).
  const visited = new Set<string>();
  const path: string[] = [course];
  const walk = (code: string): boolean => {
    for (const p of sorted(next(code))) {
      if (p === course) {
        path.push(p);
        return true;
      }
      if (visited.has(p)) continue;
      visited.add(p);
      path.push(p);
      if (walk(p)) return true;
      path.pop();
    }
    return false;
  };
  return walk(course) ? path : null;
}
