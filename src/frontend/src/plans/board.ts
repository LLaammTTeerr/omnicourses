import { termKey, TERM_NUMBERS, type Term } from '../terms.js';
import type { Placement, PlanIssue, PlanIssues, PlanTerm, PlanTermLoad } from './api.js';

export interface Tile {
  key: number;
  placement: Placement;
}

export interface Row {
  term: Term;
  tiles: Tile[];
}

export type Board = readonly Row[];

export const compareTerms = (a: Term, b: Term): number => a.year - b.year || a.number - b.number;

export function nextTerm(term: Term): Term {
  const i = TERM_NUMBERS.indexOf(term.number);
  return i === TERM_NUMBERS.length - 1 ? { year: term.year + 1, number: TERM_NUMBERS[0] } : { year: term.year, number: TERM_NUMBERS[i + 1]! };
}

export function termsBetween(first: Term, last: Term): Term[] {
  const terms: Term[] = [];
  for (let term = first; compareTerms(term, last) <= 0; term = nextTerm(term)) terms.push(term);
  return terms;
}

const minTerm = (a: Term, b: Term) => (compareTerms(a, b) <= 0 ? a : b);
const maxTerm = (a: Term, b: Term) => (compareTerms(a, b) >= 0 ? a : b);

export function rowsFor(terms: readonly PlanTerm[], current: Term, target: Term | null): Term[] {
  let first = current;
  let last = target ? maxTerm(current, target) : current;
  for (const { term } of terms) {
    first = minTerm(first, term);
    last = maxTerm(last, term);
  }
  return termsBetween(first, last);
}

export function boardOf(terms: readonly PlanTerm[], rows: readonly Term[], key: () => number): Row[] {
  const byTerm = new Map(terms.map((t) => [termKey(t.term), t.placements]));
  const all = new Map(rows.map((term) => [termKey(term), term]));
  for (const { term } of terms) all.set(termKey(term), term);
  return [...all.values()]
    .sort(compareTerms)
    .map((term) => ({ term, tiles: (byTerm.get(termKey(term)) ?? []).map((placement) => ({ key: key(), placement })) }));
}

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

export function sameTiles(a: Board, b: Board): boolean {
  const filled = (board: Board) => board.filter((row) => row.tiles.length > 0);
  const x = filled(a);
  const y = filled(b);
  return (
    x.length === y.length &&
    x.every((row, i) => {
      const other = y[i]!;
      return termKey(row.term) === termKey(other.term) && row.tiles.length === other.tiles.length && row.tiles.every((tile, j) => tile === other.tiles[j]);
    })
  );
}

export const withNextRow = (board: Board): Row[] => [...board, { term: nextTerm(board.at(-1)!.term), tiles: [] }];

export function addCourse(board: Board, code: string, to: Term, key: number): Board {
  if (placedCodes(board).has(code)) return board;
  return board.map((row) =>
    termKey(row.term) === termKey(to) ? { ...row, tiles: [...row.tiles, { key, placement: { kind: 'course', courseCode: code, requirementGroupId: null, credits: null } }] } : row,
  );
}

export function addSlot(board: Board, groupId: string, credits: number, to: Term, key: number): Board {
  return board.map((row) =>
    termKey(row.term) === termKey(to) ? { ...row, tiles: [...row.tiles, { key, placement: { kind: 'slot', courseCode: null, requirementGroupId: groupId, credits } }] } : row,
  );
}

export function removeTile(board: Board, key: number): Board {
  if (!findTile(board, key)) return board;
  return board.map((row) => (row.tiles.some((tile) => tile.key === key) ? { ...row, tiles: row.tiles.filter((tile) => tile.key !== key) } : row));
}

export function moveTile(board: Board, key: number, to: Term): Board {
  const found = findTile(board, key);
  if (!found || termKey(found.row.term) === termKey(to)) return board;
  const tile = found.row.tiles[found.index]!;
  return board.map((row) => {
    if (row === found.row) return { ...row, tiles: row.tiles.filter((t) => t.key !== key) };
    if (termKey(row.term) === termKey(to)) return { ...row, tiles: [...row.tiles, tile] };
    return row;
  });
}

export interface AttachedIssues {
  board: Board;
  report: PlanIssues;
  byTile: Map<number, PlanIssue[]>;
  tileOf: Map<PlanIssue, number>;
  byTerm: Map<string, PlanIssue[]>;
  loads: Map<string, PlanTermLoad>;
  plan: PlanIssue[];
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

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

export type Moving = { key: number } | { code: string } | { slot: string; credits: number };

export const PREVIEW_KEY = -1;

export function boardWith(board: Board, what: Moving, to: Term): Board {
  if ('key' in what) return moveTile(board, what.key, to);
  if ('code' in what) return addCourse(board, what.code, to, PREVIEW_KEY);
  return addSlot(board, what.slot, what.credits, to, PREVIEW_KEY);
}

export const homeOf = (board: Board, what: Moving): Term | undefined => ('key' in what ? findTile(board, what.key)?.row.term : undefined);

export const isHome = (board: Board, what: Moving, key: string): boolean => {
  const home = homeOf(board, what);
  return !!home && termKey(home) === key;
};

export function placementOf(board: Board, what: Moving): Placement | null {
  if ('code' in what) return { kind: 'course', courseCode: what.code, requirementGroupId: null, credits: null };
  if ('slot' in what) return { kind: 'slot', courseCode: null, requirementGroupId: what.slot, credits: what.credits };
  const found = findTile(board, what.key);
  return found ? found.row.tiles[found.index]!.placement : null;
}

export const issueId = (i: PlanIssue) => [i.code, i.courseCode ?? '', i.term ? termKey(i.term) : '', i.requirementGroupId ?? ''].join('|');

export interface DropVerdict {
  kind: 'violation' | 'flag' | 'unknown' | null;
  issues: PlanIssue[];
  load: PlanTermLoad | null;
}

export function dropVerdict(attached: AttachedIssues, key: number, to: Term, before: AttachedIssues | null): DropVerdict {
  const mine = [...(attached.byTile.get(key) ?? []), ...(attached.byTerm.get(termKey(to)) ?? [])];
  const had = new Set(before?.report.issues.filter((i) => i.kind === 'violation').map(issueId) ?? []);
  const elsewhere = before ? attached.report.issues.filter((i) => i.kind === 'violation' && i.term !== null && !mine.includes(i) && !had.has(issueId(i))) : [];
  const issues = [...mine.filter((i) => i.kind === 'violation'), ...elsewhere, ...mine.filter((i) => i.kind === 'flag'), ...mine.filter((i) => i.kind === 'unknown')];
  const load = attached.loads.get(termKey(to)) ?? null;
  return { kind: issues[0]?.kind ?? null, issues, load };
}
