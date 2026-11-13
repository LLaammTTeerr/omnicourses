import { describe, expect, it } from 'vitest';
import { BoardTerm, courseCodesOf, Placement } from '../rules/inputs.js';
import { boardProblems, groupIdsOf, toBoard, toRows, withPlacement } from './plan-board.js';
import type { PlanPlacement } from './plan-placement.entity.js';

// Synthetic codes only (AGENTS.md hard rule 3).
const course = (courseCode: string): Placement => ({ kind: 'course', courseCode, requirementGroupId: null, credits: null });
const slot = (requirementGroupId: string, credits: number): Placement => ({ kind: 'slot', courseCode: null, requirementGroupId, credits });

const board: BoardTerm[] = [
  { term: { year: 2030, number: 1 }, placements: [course('ZZ002'), course('ZZ001')] },
  { term: { year: 2030, number: 3 }, placements: [slot('g1', 3), course('ZZ003')] },
];

describe('boardProblems', () => {
  it('accepts a sound board and an empty one', () => {
    expect(boardProblems(board)).toEqual([]);
    expect(boardProblems([])).toEqual([]);
  });

  it('refuses a term listed twice and a course placed twice', () => {
    expect(boardProblems([...board, { term: { year: 2030, number: 1 }, placements: [course('ZZ001')] }])).toEqual([
      'term 2030-1 is listed twice',
      'course ZZ001 is placed twice',
    ]);
  });

  it('allows two slots of the same group, which hold separate credits', () => {
    expect(boardProblems([{ term: { year: 2030, number: 1 }, placements: [slot('g1', 3), slot('g1', 3)] }])).toEqual([]);
  });

  it('refuses more than 300 placements in all', () => {
    const terms = Array.from({ length: 11 }, (_, i): BoardTerm => ({
      term: { year: 2030 + Math.floor(i / 3), number: ((i % 3) + 1) as 1 | 2 | 3 },
      placements: Array.from({ length: 28 }, () => slot('g1', 1)),
    }));
    expect(boardProblems(terms)).toEqual(['a plan holds at most 300 placements']);
    expect(boardProblems(terms.slice(0, 10).concat({ ...terms[10]!, placements: terms[10]!.placements.slice(0, 20) }))).toEqual([]);
  });
});

describe('withPlacement (the drag preview boards)', () => {
  it('adds the placement at the end of a term that holds something, or makes the term, leaving the input alone', () => {
    expect(withPlacement(board, course('ZZ009'), { year: 2030, number: 1 })[0]).toEqual({ term: { year: 2030, number: 1 }, placements: [course('ZZ002'), course('ZZ001'), course('ZZ009')] });
    expect(withPlacement(board, course('ZZ009'), { year: 2031, number: 2 }).at(-1)).toEqual({ term: { year: 2031, number: 2 }, placements: [course('ZZ009')] });
    expect(board[0]!.placements).toHaveLength(2);
  });
});

describe('board rows', () => {
  it('lists the course codes and the slot groups', () => {
    expect(courseCodesOf(board)).toEqual(['ZZ002', 'ZZ001', 'ZZ003']);
    expect(groupIdsOf(board)).toEqual(['g1']);
  });

  it('stores each placement with its position in its term, and reads the same board back in order', () => {
    const rows = toRows('p1', 'u1', board);
    expect(rows).toEqual([
      { planId: 'p1', userId: 'u1', termYear: 2030, termNumber: 1, position: 0, courseCode: 'ZZ002', requirementGroupId: null, slotCredits: null },
      { planId: 'p1', userId: 'u1', termYear: 2030, termNumber: 1, position: 1, courseCode: 'ZZ001', requirementGroupId: null, slotCredits: null },
      { planId: 'p1', userId: 'u1', termYear: 2030, termNumber: 3, position: 0, courseCode: null, requirementGroupId: 'g1', slotCredits: 3 },
      { planId: 'p1', userId: 'u1', termYear: 2030, termNumber: 3, position: 1, courseCode: 'ZZ003', requirementGroupId: null, slotCredits: null },
    ]);
    // The database returns rows in any order.
    expect(toBoard([...rows].reverse() as PlanPlacement[])).toEqual(board);
  });

  it('orders terms across a year boundary', () => {
    const later: BoardTerm[] = [
      { term: { year: 2031, number: 1 }, placements: [course('ZZ004')] },
      { term: { year: 2030, number: 2 }, placements: [course('ZZ005')] },
    ];
    expect(toBoard(toRows('p1', 'u1', later) as PlanPlacement[]).map((t) => t.term)).toEqual([
      { year: 2030, number: 2 },
      { year: 2031, number: 1 },
    ]);
  });

  it('ignores the fields of the other kind when storing', () => {
    const [row] = toRows('p1', 'u1', [{ term: { year: 2030, number: 1 }, placements: [{ kind: 'course', courseCode: 'ZZ001', requirementGroupId: 'g1', credits: 3 }] }]);
    expect(row).toMatchObject({ courseCode: 'ZZ001', requirementGroupId: null, slotCredits: null });
  });
});
