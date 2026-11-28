type PrerequisiteGraph = ReadonlyMap<string, readonly string[]>;

export function findPrerequisiteCycle(graph: PrerequisiteGraph, course: string, prerequisites: readonly string[]): string[] | null {
  const next = (code: string): readonly string[] => (code === course ? prerequisites : (graph.get(code) ?? []));
  const sorted = (codes: readonly string[]) => [...codes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

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
