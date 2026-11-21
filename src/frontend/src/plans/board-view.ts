import type { GroupId } from '../groups.js';
import type { PlanIssue, PlanIssueCode, PlanIssueKind, PlanTermLoad } from './api.js';
import type { Row, Tile } from './board.js';
import { strongest } from './present.js';

// What each row and tile of the planner board shows (PlanEditorView works it out once per change), and the drawing
// rules it uses. Drawing only: every verdict comes from the engine's issues and loads (AGENTS.md hard rule 1).

export interface TileView {
  tile: Tile;
  title: string;
  label: string;
  credits: number | null;
  name: string | null;
  group: string | null;
  slot: boolean;
  taken: string | null;
  colour: GroupId | null;
  /** The tile's issues in words, for its tooltip. */
  tip: string;
  classes: string[];
  bad: boolean;
  /** Violations, then flags. */
  issues: PlanIssue[];
  unknowns: PlanIssueCode[];
}

export interface RowView {
  row: Row;
  key: string;
  name: string;
  summer: boolean;
  now: boolean;
  when: string;
  load: { atLeast: boolean; caps: string; credits: number; max: number | null; delta: number } | null;
  meter: { fill: number; from: number; to: number; min: number | null; minLabel: number | null; max: number; maxLabel: number } | null;
  /** The meter's colour, from the engine's load issues for this row (with the drop made, while one is previewed). */
  cap: 'under' | 'over' | 'ok' | '';
  tone: string;
  drop: { tone: string; reason: string } | null;
  /** The dashed tile where a drop would land, while the pointer is over this row. */
  placeholder: { title: string; credits: number | null; colour: GroupId | null } | null;
  issues: PlanIssue[];
  tiles: TileView[];
}

export function capOf(issues: readonly PlanIssue[], credits: number): RowView['cap'] {
  if (issues.some((i) => i.code === 'load_above_maximum')) return 'over';
  if (issues.some((i) => i.code === 'load_below_minimum')) return 'under';
  return credits > 0 ? 'ok' : '';
}

/** Issues the credit bar already shows (over or under the caps): the row gives them no words of its own. */
export const BAR_CODES: ReadonlySet<PlanIssue['code']> = new Set(['load_above_maximum', 'load_below_minimum']);

/** A row's or tile's class for its most serious issue; an unknown alone colours nothing. */
export const toneOf = (issues: readonly PlanIssue[]): string => {
  const kind = strongest(issues.filter((i) => i.kind !== 'unknown'));
  return kind ? `has-${kind}` : '';
};

/** A row's class while a drop on it is previewed, by the most serious issue the drop adds. */
export const DROP_TONE: Record<PlanIssueKind, string> = { violation: 'bad-drop', flag: 'warn-drop', unknown: 'unknown-drop' };

/** A tile's issues: the violations, then the flags, shown one by one; the codes the engine could not check, apart. */
export function splitIssues(all: readonly PlanIssue[]): { shown: PlanIssue[]; unknowns: PlanIssueCode[] } {
  return {
    shown: [...all.filter((i) => i.kind === 'violation'), ...all.filter((i) => i.kind === 'flag')],
    unknowns: all.filter((i) => i.kind === 'unknown').map((i) => i.code),
  };
}

/** The meter runs a little past the maximum, so a load above it still shows. Drawing only: the engine compares. */
export function meter(load: PlanTermLoad | null, base: number): RowView['meter'] {
  if (!load?.caps) return null;
  const scale = load.caps.max + 6;
  const pct = (n: number) => Math.max(0, Math.min(100, (n / scale) * 100));
  return {
    fill: pct(Math.min(base, load.credits)),
    from: pct(Math.min(base, load.credits)),
    to: pct(Math.max(base, load.credits)),
    min: load.caps.min === null ? null : pct(load.caps.min),
    minLabel: load.caps.min,
    max: pct(load.caps.max),
    maxLabel: load.caps.max,
  };
}
