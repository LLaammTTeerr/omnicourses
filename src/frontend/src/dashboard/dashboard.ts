import type { CalendarEvent } from '../calendar/api.js';
import { GROUP_IDS, type GroupId } from '../groups.js';
import type { Lang } from '../locale.js';
import type { Plan } from '../plans/api.js';
import { sameTerm, termKey, type Term } from '../terms.js';
import type { CourseCoverage, DegreeAudit, TermAttempt, TermSummary } from '../audit/api.js';
import { shownGroups } from '../audit/present.js';

export type Colour = GroupId | 'none';

export interface Row {
  key: string;
  hash: string;
  name: string;
  colour: GroupId;
  required: number;
  groupIds: string[];
  codes: string[];
}

export interface CourseLine {
  code: string;
  name: string;
  credits: number;
  grade: number | null;
  retaken: boolean;
}

export interface TodoTerm {
  term: Term;
  credits: number;
  lines: (CourseLine | { slot: true; credits: number })[];
}

export interface RowState {
  row: Row;
  d: number;
  c: number;
  left: number | null;
  cur: CourseLine[];
  fail: CourseLine[];
  todo: TodoTerm[];
  unplaced: number | null;
  done: CourseLine[];
}

export interface TermCourse {
  code: string;
  name: string;
  credits: number;
  colour: Colour;
  rowHash: string | null;
  grade: number | null;
  failed: boolean;
  inProgress: boolean;
}

export interface Snapshot {
  index: number;
  live: boolean;
  term: Term;
  summary: TermSummary | null;
  rows: RowState[];
  passed: number;
  courses: TermCourse[];
}

export type CellState = 'done' | 'fail' | 'cur' | 'todo';

export interface StripCell {
  code: string;
  name: string;
  credits: number;
  colour: Colour;
  state: CellState;
}

export interface StripTerm {
  term: Term;
  index: number | null;
  now: boolean;
  cells: StripCell[];
  credits: number;
}

export interface DashboardInput {
  audit: DegreeAudit;
  past: ReadonlyMap<string, DegreeAudit>;
  plan: Plan | null;
  today: Term;
}

const compare = (a: Term, b: Term) => a.year - b.year || a.number - b.number;
const sum = (list: readonly { credits: number }[]) => list.reduce((total, x) => total + x.credits, 0);

export class Dashboard {
  readonly rows: Row[];
  readonly history: TermSummary[];
  readonly liveTerm: Term;
  private readonly live: TermSummary | null;
  private readonly placed = new Map<string, Term>();

  constructor(private readonly input: DashboardInput) {
    this.rows = rowsOf(input.audit);
    for (const t of input.plan?.terms ?? []) for (const p of t.placements) if (p.kind === 'course' && p.courseCode) this.placed.set(p.courseCode, t.term);
    this.liveTerm = liveTermOf(input.audit.terms, input.today);
    this.history = input.audit.terms.filter((t) => compare(t.term, this.liveTerm) < 0).sort((a, b) => compare(a.term, b.term));
    this.live = input.audit.terms.find((t) => sameTerm(t.term, this.liveTerm)) ?? null;
  }

  get nowIndex(): number {
    return this.history.length;
  }

  termAt(index: number): Term {
    return index === this.nowIndex ? this.liveTerm : this.history[index]!.term;
  }

  auditAt(index: number): DegreeAudit | null {
    return index === this.nowIndex ? this.input.audit : (this.input.past.get(termKey(this.history[index]!.term)) ?? null);
  }

  name(code: string, lang: Lang): string {
    const c = coverageOf(this.input.audit, code);
    if (c) return lang === 'en' ? (c.nameEn ?? c.nameVi) : c.nameVi;
    return this.input.audit.terms.flatMap((t) => t.attempts).find((a) => a.code === code)?.name ?? code;
  }

  private rowOf(groupId: string | null): Row | null {
    return groupId === null ? null : (this.rows.find((r) => r.groupIds.includes(groupId)) ?? null);
  }

  private retaken(code: string): boolean {
    return this.input.audit.terms.some((t) => t.attempts.some((a) => a.code === code && !a.passed && !a.inProgress));
  }

  private line(audit: DegreeAudit, code: string, lang: Lang, grade: number | null): CourseLine {
    return { code, name: this.name(code, lang), credits: coverageOf(audit, code)?.credits ?? 0, grade, retaken: this.retaken(code) };
  }

  snapshot(index: number, lang: Lang): Snapshot | null {
    const audit = this.auditAt(index);
    if (!audit) return null;
    const live = index === this.nowIndex;
    const summary = live ? this.live : this.history[index]!;
    return {
      index,
      live,
      term: this.termAt(index),
      summary: live ? null : summary,
      rows: this.rows.map((row) => this.rowState(audit, row, live, lang)),
      passed: audit.credits.towardTotal,
      courses: (summary?.attempts ?? []).map((a) => this.termCourse(a, lang)),
    };
  }

  private rowState(audit: DegreeAudit, row: Row, live: boolean, lang: Lang): RowState {
    const groups = audit.groups.filter((g) => row.groupIds.includes(g.id));
    const combined = audit.combinedMinimums.find((c) => c.id === row.key);
    const d = combined ? combined.credits : groups.reduce((t, g) => t + g.passedCredits + g.overflowInCredits, 0);
    const c = combined ? combined.inProgressCredits : groups.reduce((t, g) => t + g.inProgressCredits, 0);
    const left = combined ? combined.remainingCredits : (groups[0]?.remainingCredits ?? null);
    const of = (status: string) => row.codes.filter((code) => coverageOf(audit, code)?.status === status);
    const retry = (code: string) => live && this.placed.has(code);
    const graded = (code: string) => this.line(audit, code, lang, coverageOf(audit, code)?.grade ?? null);
    return this.withTodo(row, {
      d,
      c,
      left,
      cur: of('in_progress').map((code) => this.line(audit, code, lang, null)),
      fail: of('failed').filter((code) => !retry(code)).map(graded),
      done: of('passed').map(graded),
      pending: [...of('not_taken'), ...of('failed').filter(retry)].map((code) => this.line(audit, code, lang, null)),
    });
  }

  private withTodo(row: Row, s: Omit<RowState, 'row' | 'todo' | 'unplaced'> & { pending: CourseLine[] }): RowState {
    const byTerm = new Map<string, TodoTerm>();
    const add = (term: Term, item: CourseLine | { slot: true; credits: number }) => {
      const k = termKey(term);
      const entry = byTerm.get(k) ?? { term, credits: 0, lines: [] };
      entry.lines.push(item);
      entry.credits += item.credits;
      byTerm.set(k, entry);
    };
    for (const line of s.pending) {
      const term = this.placed.get(line.code);
      if (term) add(term, line);
    }
    for (const t of this.input.plan?.terms ?? []) {
      for (const p of t.placements) {
        if (p.kind === 'slot' && p.requirementGroupId && row.groupIds.includes(p.requirementGroupId)) add(t.term, { slot: true, credits: p.credits ?? 0 });
      }
    }
    const todo = [...byTerm.values()].sort((a, b) => compare(a.term, b.term));
    const { pending: _, ...rest } = s;
    return { row, ...rest, todo, unplaced: s.left === null ? null : Math.max(0, s.left - sum(todo)) };
  }

  private termCourse(a: TermAttempt, lang: Lang): TermCourse {
    const row = this.rowOf(a.requirementGroupId);
    return { code: a.code, name: this.name(a.code, lang), credits: a.credits, colour: row?.colour ?? 'none', rowHash: row?.hash ?? null, grade: a.grade, failed: !a.passed && !a.inProgress, inProgress: a.inProgress };
  }

  strip(lang: Lang): StripTerm[] {
    const cell = (code: string, credits: number, colour: Colour, state: CellState): StripCell => ({ code, name: this.name(code, lang), credits, colour, state });
    const fromAttempt = (a: TermAttempt) => cell(a.code, a.credits, this.rowOf(a.requirementGroupId)?.colour ?? 'none', a.inProgress ? 'cur' : a.passed ? 'done' : 'fail');
    const past = this.history.map((summary, index) => {
      const cells = summary.attempts.map(fromAttempt);
      return { term: summary.term, index, now: false, cells, credits: sum(cells) };
    });
    const nowCells = (this.live?.attempts ?? []).map(fromAttempt);
    const now = { term: this.liveTerm, index: this.nowIndex, now: true, cells: nowCells, credits: sum(nowCells) };
    const future = (this.input.plan?.terms ?? [])
      .filter((t) => compare(t.term, this.liveTerm) > 0)
      .sort((a, b) => compare(a.term, b.term))
      .map((t) => {
        const cells = t.placements.flatMap((p): StripCell[] => {
          if (p.kind === 'slot') return [{ code: '', name: '', credits: p.credits ?? 0, colour: this.rowOf(p.requirementGroupId ?? null)?.colour ?? 'none', state: 'todo' }];
          const c = p.courseCode ? coverageOf(this.input.audit, p.courseCode) : null;
          if (!c || c.status === 'passed' || c.status === 'in_progress') return [];
          return [cell(c.code, c.credits, this.rows.find((r) => r.codes.includes(c.code))?.colour ?? 'none', 'todo')];
        });
        return { term: t.term, index: null, now: false, cells, credits: sum(cells) };
      });
    return [...past, now, ...future].filter((t) => t.now || t.cells.length > 0);
  }

  gpaChange(index: number): { change: number; since: Term } | null {
    for (let i = Math.min(index, this.history.length - 1); i > 0; i--) {
      const t = this.history[i]!;
      if (t.average === null) continue;
      return t.cumulativeAccumulatedAverageChange === null ? null : { change: t.cumulativeAccumulatedAverageChange, since: this.history[i - 1]!.term };
    }
    return null;
  }

  slotCredits(): number {
    return (this.input.plan?.terms ?? []).flatMap((t) => t.placements).reduce((total, p) => total + (p.kind === 'slot' ? (p.credits ?? 0) : 0), 0);
  }
}

function coverageOf(audit: DegreeAudit, code: string): CourseCoverage | null {
  for (const g of audit.groups) for (const c of g.courses) if (c.code === code && c.status !== 'counted_in_other_group') return c;
  return null;
}

const FALLBACK_COMBINED_COLOUR: GroupId = 'elec';

function rowsOf(audit: DegreeAudit): Row[] {
  const shown = shownGroups(audit);
  const codesOf = (ids: string[]) =>
    audit.groups.filter((g) => ids.includes(g.id)).flatMap((g) => g.courses.filter((c) => c.status !== 'counted_in_other_group').map((c) => c.code));
  const groups = shown
    .filter(({ group }) => group.requiredCredits !== null)
    .map(({ group, colour }) => ({ key: group.id, hash: `#group-${group.id}`, name: group.name, colour, required: group.requiredCredits!, groupIds: [group.id], codes: codesOf([group.id]) }));
  const combined = audit.combinedMinimums.map((c) => ({
    key: c.id,
    hash: `#combined-${c.id}`,
    name: c.name,
    colour: shown.find((s) => c.groupIds.includes(s.group.id))?.colour ?? FALLBACK_COMBINED_COLOUR,
    required: c.creditsMin,
    groupIds: [...c.groupIds],
    codes: codesOf(c.groupIds),
  }));
  return [...groups, ...combined].sort((a, b) => GROUP_IDS.indexOf(a.colour) - GROUP_IDS.indexOf(b.colour));
}

function liveTermOf(terms: readonly TermSummary[], today: Term): Term {
  const inProgress = terms.filter((t) => t.inProgressCourseCodes.length > 0).map((t) => t.term).sort(compare).pop();
  return inProgress ?? today;
}

export function calendarEnd(events: readonly CalendarEvent[], term: Term): string | null {
  const end = events.find((e) => e.kind === 'term_end' && e.academicYear === term.year && e.term === term.number);
  if (!end) return null;
  const [year, month] = end.endsOn.split('-');
  return `${month}/${year}`;
}

export const DONUT = { size: 200, outer: 104, inner: 74, gapDegrees: 0.6, sweepRadius: 89 } as const;
const FULL_TURN = 360;
const QUARTER_TURN = 90;
const HALF_TURN = 180;
const MIN_SPAN_DEGREES = 0.01;

export type SegmentKind = 'd' | 'c' | 'left';

export interface Segment {
  state: RowState;
  kind: SegmentKind;
  path: string;
  hit: string;
}

function point(radius: number, degrees: number): [number, number] {
  const a = ((degrees - QUARTER_TURN) * Math.PI) / HALF_TURN;
  const centre = DONUT.size / 2;
  return [centre + radius * Math.cos(a), centre + radius * Math.sin(a)];
}

export function sector(from: number, to: number): string {
  if (to - from <= MIN_SPAN_DEGREES) return '';
  const big = to - from > HALF_TURN ? 1 : 0;
  const { outer: R, inner: r } = DONUT;
  const [x0, y0] = point(R, from);
  const [x1, y1] = point(R, to);
  const [x2, y2] = point(r, to);
  const [x3, y3] = point(r, from);
  return `M${x0} ${y0}A${R} ${R} 0 ${big} 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 ${big} 0 ${x3} ${y3}Z`;
}

export function segments(rows: readonly RowState[]): Segment[] {
  const parts: { state: RowState; kind: SegmentKind; n: number }[] = [];
  for (const kind of ['d', 'c', 'left'] as const) {
    for (const state of rows) {
      const n = kind === 'd' ? Math.min(state.d, state.row.required) : state[kind];
      if (n !== null && n > 0) parts.push({ state, kind, n });
    }
  }
  const ring = parts.reduce((t, p) => t + p.n, 0);
  let at = 0;
  return parts.map((p) => {
    const span = (p.n / ring) * FULL_TURN;
    const seg = { state: p.state, kind: p.kind, path: sector(at + DONUT.gapDegrees / 2, at + span - DONUT.gapDegrees / 2), hit: sector(at, at + span) };
    at += span;
    return seg;
  });
}

export const SPARK = { width: 104, height: 34, pad: 5, inset: 10, bleed: 6, dot: 2.6, dotOn: 4, hit: 8 } as const;
export interface Plotted {
  x: number;
  y: number;
}

export const scaleOf = (values: readonly number[], margin: number): [number, number] => [Math.min(...values) - margin, Math.max(...values) + margin];

export function sparkPoints(values: readonly number[], lo: number, hi: number): Plotted[] {
  const step = values.length > 1 ? SPARK.width / (values.length - 1) : 0;
  const y = (v: number) => SPARK.height - SPARK.pad - ((v - lo) / (hi - lo)) * (SPARK.height - SPARK.inset);
  return values.map((v, i) => ({ x: values.length > 1 ? i * step : SPARK.width / 2, y: y(v) }));
}

export const termShort = (term: Term, lang: Lang) =>
  `${term.number === 3 ? (lang === 'vi' ? 'Hè ' : 'Summer ') : `${lang === 'vi' ? 'HK' : 'T'}${term.number} `}${String(term.year).slice(2)}–${String(term.year + 1).slice(2)}`;
