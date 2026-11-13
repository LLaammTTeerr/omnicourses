import { compareTerms, nextTerm, sameTerm, termKey, termsBetween, type Term } from '../terms.js';
import type { Placement, PlanIssue, PlanIssues, PlanTerm, PlanTermLoad } from './api.js';

// The planner's board: the rows on screen and the tiles in them. Moving tiles around is bookkeeping only. Nothing
// here decides whether a placement is allowed, a load is too heavy or a requirement is covered: those answers come
// from GET /plans/{id}/issues (AGENTS.md hard rule 1), and `attachIssues` only pins each one to the tile or row it
// names. Every change returns a new board, so the editor can tell a saved or checked board from the one on screen.

/** A placement on screen, with a key that stays with it while it moves. */
export interface Tile {
  key: number;
  placement: Placement;
}

export interface Row {
  term: Term;
  tiles: Tile[];
}

export type Board = readonly Row[];

const minTerm = (a: Term, b: Term) => (compareTerms(a, b) <= 0 ? a : b);
const maxTerm = (a: Term, b: Term) => (compareTerms(a, b) >= 0 ? a : b);

/**
 * The rows the planner draws (ADR 0014: an empty term is not stored, the planner draws them): from the current term,
 * or the plan's first term if earlier, up to the target graduation term, or the plan's last term if later.
 */
export function rowsFor(terms: readonly PlanTerm[], current: Term, target: Term | null): Term[] {
  let first = current;
  let last = target ? maxTerm(current, target) : current;
  for (const { term } of terms) {
    first = minTerm(first, term);
    last = maxTerm(last, term);
  }
  return termsBetween(first, last);
}

/** The board for a saved plan, with a row for each term of `rows` and of the plan. */
export function boardOf(terms: readonly PlanTerm[], rows: readonly Term[], key: () => number): Row[] {
  const byTerm = new Map(terms.map((t) => [termKey(t.term), t.placements]));
  const all = new Map(rows.map((term) => [termKey(term), term]));
  for (const { term } of terms) all.set(termKey(term), term);
  return [...all.values()]
    .sort(compareTerms)
    .map((term) => ({ term, tiles: (byTerm.get(termKey(term)) ?? []).map((placement) => ({ key: key(), placement })) }));
}

/** The body of PUT /plans/{id}/placements: rows with nothing placed are left out, as the API requires. */
export function boardBody(board: Board): PlanTerm[] {
  return board.filter((row) => row.tiles.length > 0).map((row) => ({ term: row.term, placements: row.tiles.map((tile) => tile.placement) }));
}

export const placedCodes = (board: Board): Set<string> =>
  new Set(board.flatMap((row) => row.tiles.flatMap((tile) => (tile.placement.courseCode ? [tile.placement.courseCode] : []))));

export function findTile(board: Board, key: number): { row: Row; index: number } | null {
  for (const row of board) {
    const index = row.tiles.findIndex((tile) => tile.key === key);
    if (index >= 0) return { row, index };
  }
  return null;
}

/**
 * Whether two boards hold the same tiles in the same places. Rows with nothing placed do not count, as they are not
 * stored (ADR 0014); a tile keeps its object while it moves, so a course removed and added again is a new tile.
 */
export function sameTiles(a: Board, b: Board): boolean {
  const filled = (board: Board) => board.filter((row) => row.tiles.length > 0);
  const x = filled(a);
  const y = filled(b);
  return (
    x.length === y.length &&
    x.every((row, i) => {
      const other = y[i]!;
      return sameTerm(row.term, other.term) && row.tiles.length === other.tiles.length && row.tiles.every((tile, j) => tile === other.tiles[j]);
    })
  );
}

/** A row added after the last one. */
export const withNextRow = (board: Board): Row[] => [...board, { term: nextTerm(board.at(-1)!.term), tiles: [] }];

/** Places a course at the end of a row. A course already on the board is not placed again (ADR 0014). */
export function addCourse(board: Board, code: string, to: Term, key: number): Board {
  if (placedCodes(board).has(code)) return board;
  return board.map((row) =>
    sameTerm(row.term, to) ? { ...row, tiles: [...row.tiles, { key, placement: { kind: 'course', courseCode: code, requirementGroupId: null, credits: null } }] } : row,
  );
}

/** Holds credits for a requirement group in a row, before a course is chosen (a slot, ADR 0014). */
export function addSlot(board: Board, groupId: string, credits: number, to: Term, key: number): Board {
  return board.map((row) =>
    sameTerm(row.term, to) ? { ...row, tiles: [...row.tiles, { key, placement: { kind: 'slot', courseCode: null, requirementGroupId: groupId, credits } }] } : row,
  );
}

export function removeTile(board: Board, key: number): Board {
  if (!findTile(board, key)) return board;
  return board.map((row) => (row.tiles.some((tile) => tile.key === key) ? { ...row, tiles: row.tiles.filter((tile) => tile.key !== key) } : row));
}

/** Moves a tile to the end of another row. */
export function moveTile(board: Board, key: number, to: Term): Board {
  const found = findTile(board, key);
  if (!found || sameTerm(found.row.term, to)) return board;
  const tile = found.row.tiles[found.index]!;
  return board.map((row) => {
    if (row === found.row) return { ...row, tiles: row.tiles.filter((t) => t.key !== key) };
    if (sameTerm(row.term, to)) return { ...row, tiles: [...row.tiles, tile] };
    return row;
  });
}

/** The engine's report pinned to what it is about, on the board it was computed for. */
export interface AttachedIssues {
  /** The board the report describes: issues are fresh while the board on screen holds the same tiles (`sameTiles`). */
  board: Board;
  report: PlanIssues;
  byTile: Map<number, PlanIssue[]>;
  /** The tile an issue is pinned to, if any. */
  tileOf: Map<PlanIssue, number>;
  /** Issues about a whole term (its load, its caps), by term key. */
  byTerm: Map<string, PlanIssue[]>;
  loads: Map<string, PlanTermLoad>;
  /** Issues about the whole plan (coverage). */
  plan: PlanIssue[];
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * Pins each issue to the tile it names (its term and its position in the saved placements) or to its term. A
 * position that names no tile, which only a report for another board could do, goes on the term instead.
 */
export function attachIssues(board: Board, report: PlanIssues): AttachedIssues {
  const rows = new Map(board.map((row) => [termKey(row.term), row]));
  const byTile = new Map<number, PlanIssue[]>();
  const tileOf = new Map<PlanIssue, number>();
  const byTerm = new Map<string, PlanIssue[]>();
  const plan: PlanIssue[] = [];
  for (const issue of report.issues) {
    if (!issue.term) {
      plan.push(issue);
      continue;
    }
    const tile = issue.position === null ? undefined : rows.get(termKey(issue.term))?.tiles[issue.position];
    if (tile) {
      push(byTile, tile.key, issue);
      tileOf.set(issue, tile.key);
    } else push(byTerm, termKey(issue.term), issue);
  }
  const loads = new Map(report.terms.map((load) => [termKey(load.term), load]));
  return { board, report, byTile, tileOf, byTerm, loads, plan };
}

/** What is being dragged or lifted: a tile of the board, or a course of the tray. */
export type Moving = { key: number } | { code: string } | { slot: string; credits: number };

/** The key a course of the tray gets on a board made only to preview it: no tile of a real board has it. */
export const PREVIEW_KEY = -1;

/** The board as it would be with `what` dropped on the row of `to`, for the rule engine to check before a drop. */
export function boardWith(board: Board, what: Moving, to: Term): Board {
  if ('key' in what) return moveTile(board, what.key, to);
  if ('code' in what) return addCourse(board, what.code, to, PREVIEW_KEY);
  return addSlot(board, what.slot, what.credits, to, PREVIEW_KEY);
}

/** What is dropped, as the placement it would add. */
export function placementOf(board: Board, what: Moving): Placement | null {
  if ('code' in what) return { kind: 'course', courseCode: what.code, requirementGroupId: null, credits: null };
  if ('slot' in what) return { kind: 'slot', courseCode: null, requirementGroupId: what.slot, credits: what.credits };
  const found = findTile(board, what.key);
  return found ? found.row.tiles[found.index]!.placement : null;
}

/** An issue's identity across two reports: its code, course, term and group (positions move when a tile does). */
export const issueId = (i: PlanIssue) => [i.code, i.courseCode ?? '', i.term ? termKey(i.term) : '', i.requirementGroupId ?? ''].join('|');

/** How a row would take a drop, from the engine's report on the board with the drop made. */
export interface DropVerdict {
  /**
   * violation: the drop breaks a rule, here or in a term elsewhere. flag: allowed, worth a look. unknown: the engine
   * could not check a rule for lack of data, which never reads as a pass (#80). null: the engine reports nothing.
   */
  kind: 'violation' | 'flag' | 'unknown' | null;
  /** Violations about the dropped tile or its row, then new ones elsewhere, then flags, then unknowns. */
  issues: PlanIssue[];
  load: PlanTermLoad | null;
}

/**
 * The verdict on a drop. `before` is the report on the board without it: a violation the drop adds in another term
 * (moving a prerequisite after the course that needs it flags that course) counts too.
 */
export function dropVerdict(attached: AttachedIssues, key: number, to: Term, before: AttachedIssues | null): DropVerdict {
  const mine = [...(attached.byTile.get(key) ?? []), ...(attached.byTerm.get(termKey(to)) ?? [])];
  const had = new Set(before?.report.issues.filter((i) => i.kind === 'violation').map(issueId) ?? []);
  const elsewhere = before ? attached.report.issues.filter((i) => i.kind === 'violation' && i.term !== null && !mine.includes(i) && !had.has(issueId(i))) : [];
  const issues = [...mine.filter((i) => i.kind === 'violation'), ...elsewhere, ...mine.filter((i) => i.kind === 'flag'), ...mine.filter((i) => i.kind === 'unknown')];
  const load = attached.loads.get(termKey(to)) ?? null;
  return { kind: issues[0]?.kind ?? null, issues, load };
}
