import { describe, expect, it } from 'vitest';
import type { Term } from '../terms.js';
import { addCourse, attachIssues, boardBody, boardOf, moveTile, nextTerm, placedCodes, removeTile, rowsFor, termsBetween, withNextRow, type Board } from './board.js';
import { course, issue, report } from './testing/fixtures.js';

const t = (year: number, number: 1 | 2 | 3): Term => ({ year, number });
const keys = () => {
  let n = 0;
  return () => n++;
};
const codes = (board: Board) => board.map((row) => `${row.term.year}-${row.term.number}: ${row.tiles.map((tile) => tile.placement.courseCode ?? 'slot').join(' ')}`);

describe('terms on the board', () => {
  it('counts three terms a year (ADR 0009)', () => {
    expect(nextTerm(t(2026, 1))).toEqual(t(2026, 2));
    expect(nextTerm(t(2026, 3))).toEqual(t(2027, 1));
    expect(termsBetween(t(2026, 2), t(2027, 1))).toEqual([t(2026, 2), t(2026, 3), t(2027, 1)]);
    expect(termsBetween(t(2027, 1), t(2026, 1))).toEqual([]);
  });

  it('draws rows from the current term to the target, widened to every term of the plan', () => {
    expect(rowsFor([], t(2026, 1), t(2026, 3))).toEqual([t(2026, 1), t(2026, 2), t(2026, 3)]);
    expect(rowsFor([], t(2026, 1), null)).toEqual([t(2026, 1)]);
    expect(rowsFor([], t(2026, 2), t(2025, 1))).toEqual([t(2026, 2)]);
    const terms = [{ term: t(2025, 3), placements: [course('ZZ101')] }, { term: t(2027, 1), placements: [course('ZZ102')] }];
    expect(rowsFor(terms, t(2026, 1), t(2026, 2))).toEqual(termsBetween(t(2025, 3), t(2027, 1)));
  });
});

describe('board changes', () => {
  const start = () => boardOf([{ term: t(2026, 1), placements: [course('ZZ101'), course('ZZ102')] }], [t(2026, 1), t(2026, 2)], keys());

  it('adds, moves and removes tiles, keeping each change a new board', () => {
    const board = start();
    const added = addCourse(board, 'ZZ201', t(2026, 2), 99);
    expect(codes(added)).toEqual(['2026-1: ZZ101 ZZ102', '2026-2: ZZ201']);
    expect(codes(board)).toEqual(['2026-1: ZZ101 ZZ102', '2026-2: ']);
    expect(addCourse(added, 'ZZ201', t(2026, 1), 100)).toBe(added);
    const moved = moveTile(added, 0, t(2026, 2));
    expect(codes(moved)).toEqual(['2026-1: ZZ102', '2026-2: ZZ201 ZZ101']);
    expect(moveTile(moved, 0, t(2026, 2))).toBe(moved);
    expect(codes(removeTile(moved, 99))).toEqual(['2026-1: ZZ102', '2026-2: ZZ101']);
    expect(removeTile(moved, 12345)).toBe(moved);
    expect([...placedCodes(moved)].sort()).toEqual(['ZZ101', 'ZZ102', 'ZZ201']);
    expect(codes(withNextRow(board))).toEqual(['2026-1: ZZ101 ZZ102', '2026-2: ', '2026-3: ']);
  });

  it('leaves empty rows out of the saved body, as the API requires', () => {
    expect(boardBody(start())).toEqual([{ term: t(2026, 1), placements: [course('ZZ101'), course('ZZ102')] }]);
    expect(boardBody(removeTile(removeTile(start(), 0), 1))).toEqual([]);
  });
});

describe('attaching the report', () => {
  it('pins an issue to the tile at its term and position, a load issue to its term and coverage to the plan', () => {
    const board = boardOf([{ term: t(2026, 1), placements: [course('ZZ101'), course('ZZ102')] }], [], keys());
    const onTile = issue({ code: 'prerequisite_not_met', kind: 'violation', term: t(2026, 1), position: 1, courseCode: 'ZZ102' });
    const onTerm = issue({ code: 'load_below_minimum', kind: 'flag', term: t(2026, 1) });
    const lost = issue({ code: 'not_offered', kind: 'violation', term: t(2026, 1), position: 7 });
    const coverage = issue({ code: 'requirement_not_covered', kind: 'violation' });
    const load = { term: t(2026, 1), kind: 'main' as const, credits: 8, caps: { min: 10, max: 22 } };
    const attached = attachIssues(board, report({ terms: [load], issues: [onTile, onTerm, lost, coverage] }));
    expect(attached.byTile.get(1)).toEqual([onTile]);
    expect(attached.tileOf.get(onTile)).toBe(1);
    expect(attached.byTerm.get('2026-1')).toEqual([onTerm, lost]);
    expect(attached.plan).toEqual([coverage]);
    expect(attached.loads.get('2026-1')).toBe(load);
    expect(attached.board).toBe(board);
  });

  it('keeps an issue with its tile when the tile moves', () => {
    const board = boardOf([{ term: t(2026, 1), placements: [course('ZZ101')] }], [t(2026, 2)], keys());
    const attached = attachIssues(board, report({ issues: [issue({ code: 'not_offered', kind: 'violation', term: t(2026, 1), position: 0 })] }));
    const moved = moveTile(board, 0, t(2026, 2));
    expect(moved[1]!.tiles[0]!.key).toBe(0);
    expect(attached.byTile.get(0)).toHaveLength(1);
  });
});
