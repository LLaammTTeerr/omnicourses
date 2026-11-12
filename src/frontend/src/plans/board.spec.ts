import { describe, expect, it } from 'vitest';
import type { Term } from '../terms.js';
import type { PlanIssue } from './api.js';
import {
  addCourse,
  addSlot,
  attachIssues,
  boardBody,
  boardOf,
  boardWith,
  dropVerdict,
  moveTile,
  nextTerm,
  placedCodes,
  placementOf,
  PREVIEW_KEY,
  removeTile,
  rowsFor,
  sameTiles,
  termsBetween,
  withNextRow,
  type Board,
} from './board.js';
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

  it('tells boards apart by their tiles, not by their empty rows', () => {
    const board = start();
    expect(sameTiles(board, withNextRow(board))).toBe(true);
    const moved = moveTile(board, 0, t(2026, 2));
    expect(sameTiles(board, moved)).toBe(false);
    expect(sameTiles(board, moveTile(moved, 0, t(2026, 1)))).toBe(false); // back, but after ZZ102
    // Removed and added again: the same course in the same place, but a new tile, which the old report does not describe.
    const one = boardOf([{ term: t(2026, 1), placements: [course('ZZ101')] }], [t(2026, 1)], keys());
    const again = addCourse(removeTile(one, 0), 'ZZ101', t(2026, 1), 7);
    expect(boardBody(again)).toEqual(boardBody(one));
    expect(sameTiles(one, again)).toBe(false);
  });

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

describe('the drag preview', () => {
  const start = (): Board => boardOf([{ term: t(2026, 1), placements: [course('ZZ101')] }], [t(2026, 1), t(2026, 2)], keys());

  it('builds the board a drop would make: a tile moved, a course or a slot added, without touching the board on screen', () => {
    const board = start();
    expect(codes(boardWith(board, { key: 0 }, t(2026, 2)))).toEqual(['2026-1: ', '2026-2: ZZ101']);
    const added = boardWith(board, { code: 'ZZ102' }, t(2026, 2));
    expect(added[1]!.tiles).toEqual([{ key: PREVIEW_KEY, placement: course('ZZ102') }]);
    expect(boardWith(board, { code: 'ZZ101' }, t(2026, 2))).toBe(board);
    expect(boardBody(boardWith(board, { slot: 'g-elec', credits: 4 }, t(2026, 2)))[1]).toEqual({
      term: t(2026, 2),
      placements: [{ kind: 'slot', courseCode: null, requirementGroupId: 'g-elec', credits: 4 }],
    });
    expect(codes(board)).toEqual(['2026-1: ZZ101', '2026-2: ']);
    expect(codes(addSlot(board, 'g-elec', 3, t(2026, 1), 7))).toEqual(['2026-1: ZZ101 slot', '2026-2: ']);
  });

  it('reads how a row takes the drop: the tile’s and the row’s issues, new violations elsewhere, and unknowns, never as a pass', () => {
    const board = boardWith(start(), { code: 'ZZ102' }, t(2026, 2));
    const load = { term: t(2026, 2), kind: 'main' as const, credits: 4, caps: { min: 10, max: 22 } };
    const flag = issue({ code: 'load_below_minimum', kind: 'flag', term: t(2026, 2), credits: 4, limit: 10 });
    const bad = issue({ code: 'not_offered', kind: 'violation', term: t(2026, 2), position: 0, courseCode: 'ZZ102' });
    const unknown = issue({ code: 'prerequisites_not_recorded', kind: 'unknown', term: t(2026, 2), position: 0, courseCode: 'ZZ102' });
    const other = issue({ code: 'prerequisite_not_met', kind: 'violation', term: t(2026, 1), position: 0, courseCode: 'ZZ101' });
    // The board without the drop already had `other`.
    const before = attachIssues(start(), report({ issues: [other] }));
    const verdict = (issues: PlanIssue[], terms = [load]) => dropVerdict(attachIssues(board, report({ terms, issues })), PREVIEW_KEY, t(2026, 2), before);

    expect(verdict([other, flag, unknown, bad])).toEqual({ kind: 'violation', issues: [bad, flag, unknown], load });
    expect(verdict([flag, unknown]).kind).toBe('flag');
    // An unknown is its own verdict: the engine could not check, which is not a pass (#80).
    expect(verdict([other, unknown], [])).toEqual({ kind: 'unknown', issues: [unknown], load: null });
    expect(verdict([other], [])).toEqual({ kind: null, issues: [], load: null });
    // A violation the drop adds in another term counts: moving a prerequisite after the course that needs it.
    const elsewhere = issue({ code: 'not_offered', kind: 'violation', term: t(2026, 1), position: 0, courseCode: 'ZZ101' });
    expect(verdict([other, elsewhere, flag])).toEqual({ kind: 'violation', issues: [elsewhere, flag], load });
    // With no report on the board before, nothing elsewhere is taken as new.
    expect(dropVerdict(attachIssues(board, report({ issues: [elsewhere] })), PREVIEW_KEY, t(2026, 2), null).kind).toBeNull();
  });

  it('gives the placement a drop adds, for each kind of thing moved', () => {
    const board = start();
    expect(placementOf(board, { code: 'ZZ102' })).toEqual({ kind: 'course', courseCode: 'ZZ102', requirementGroupId: null, credits: null });
    expect(placementOf(board, { slot: 'g-elec', credits: 4 })).toEqual({ kind: 'slot', courseCode: null, requirementGroupId: 'g-elec', credits: 4 });
    expect(placementOf(board, { key: board[0]!.tiles[0]!.key })).toEqual(board[0]!.tiles[0]!.placement);
    expect(placementOf(board, { key: 999 })).toBeNull();
  });
});
