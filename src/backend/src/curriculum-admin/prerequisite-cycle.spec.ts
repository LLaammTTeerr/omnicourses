import { describe, expect, it } from 'vitest';
import { findPrerequisiteCycle } from './prerequisite-cycle.js';

// Synthetic course codes only.
const graph = (edges: Record<string, string[]>) => new Map(Object.entries(edges));

describe('findPrerequisiteCycle', () => {
  it('names a self-loop', () => {
    expect(findPrerequisiteCycle(graph({}), 'ZZ1', ['ZZ1'])).toEqual(['ZZ1', 'ZZ1']);
  });

  it('names a 2-cycle', () => {
    expect(findPrerequisiteCycle(graph({ ZZ2: ['ZZ1'] }), 'ZZ1', ['ZZ2'])).toEqual(['ZZ1', 'ZZ2', 'ZZ1']);
  });

  it('names a long cycle, through the path that closes it', () => {
    const g = graph({ ZZ2: ['ZZ3'], ZZ3: ['ZZ4', 'ZZ9'], ZZ4: ['ZZ5'], ZZ5: ['ZZ1'], ZZ9: [] });
    expect(findPrerequisiteCycle(g, 'ZZ1', ['ZZ2'])).toEqual(['ZZ1', 'ZZ2', 'ZZ3', 'ZZ4', 'ZZ5', 'ZZ1']);
  });

  it('accepts a DAG, including a diamond where two paths share a course', () => {
    const g = graph({ ZZ2: ['ZZ4'], ZZ3: ['ZZ4'], ZZ4: ['ZZ5'], ZZ5: [] });
    expect(findPrerequisiteCycle(g, 'ZZ1', ['ZZ2', 'ZZ3'])).toBeNull();
    expect(findPrerequisiteCycle(g, 'ZZ1', [])).toBeNull();
  });

  it("replaces the course's current edges instead of adding to them", () => {
    // ZZ1 required ZZ2 before; dropping that edge lets ZZ2 require ZZ1.
    const g = graph({ ZZ1: ['ZZ2'], ZZ2: [] });
    expect(findPrerequisiteCycle(g, 'ZZ2', ['ZZ1'])).toEqual(['ZZ2', 'ZZ1', 'ZZ2']);
    expect(findPrerequisiteCycle(graph({ ZZ1: [], ZZ2: [] }), 'ZZ2', ['ZZ1'])).toBeNull();
    // A cycle through the course's new edges only, not its old ones.
    expect(findPrerequisiteCycle(graph({ ZZ1: ['ZZ3'], ZZ3: [] }), 'ZZ1', [])).toBeNull();
  });

  it('names the same cycle whatever order the prerequisites come in', () => {
    const g = graph({ ZZ2: ['ZZ1'], ZZ3: ['ZZ1'] });
    expect(findPrerequisiteCycle(g, 'ZZ1', ['ZZ3', 'ZZ2'])).toEqual(['ZZ1', 'ZZ2', 'ZZ1']);
  });
});
