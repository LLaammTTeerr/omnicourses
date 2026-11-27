import type { CalendarEvent } from '../calendar/api.js';
import { GROUP_IDS, type GroupId } from '../groups.js';
import type { Lang } from '../locale.js';
import type { Plan } from '../plans/api.js';
import { sameTerm, termKey, type Term } from '../terms.js';
import type { TranscriptRow } from '../transcript/api.js';
import type { CourseCoverage, DegreeAudit, TermSummary } from './api.js';
import { shownGroups } from './present.js';

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
  left: number;
  cur: CourseLine[];
  fail: CourseLine[];
  todo: TodoTerm[];
  unplaced: number;
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

export interface CourseInfo {
  code: string;
  credits: number;
  coverage: CourseCoverage;
  row: Row | null;
}

export interface DashboardInput {
  audit: DegreeAudit;
  transcript: TranscriptRow[];
  plan: Plan | null;
  today: Term;
}

const compare = (a: Term, b: Term) => a.year - b.year || a.number - b.number;
const sum = (list: readonly { credits: number }[]) => list.reduce((total, x) => total + x.credits, 0);

export class Dashboard {
  readonly rows: Row[];
  readonly history: TermSummary[];
  readonly liveTerm: Term;
  readonly courses = new Map<string, CourseInfo>();
  private readonly attempts = new Map<string, TranscriptRow[]>();
  private readonly placed = new Map<string, Term>();

  constructor(private readonly input: DashboardInput) {
    this.rows = rowsOf(input.audit);
    for (const { group } of shownGroups(input.audit)) {
      for (const coverage of group.courses) {
        if (coverage.status === 'counted_in_other_group' || this.courses.has(coverage.code)) continue;
        const row = this.rows.find((r) => r.groupIds.includes(group.id)) ?? null;
        this.courses.set(coverage.code, { code: coverage.code, credits: coverage.credits, coverage, row });
      }
    }
    for (const r of [...input.transcript].sort((a, b) => compare(a.term, b.term))) {
      this.attempts.set(r.courseCode, [...(this.attempts.get(r.courseCode) ?? []), r]);
    }
    for (const t of input.plan?.terms ?? []) for (const p of t.placements) if (p.kind === 'course' && p.courseCode) this.placed.set(p.courseCode, t.term);
    this.liveTerm = liveTermOf(input.audit.terms, input.today);
    this.history = input.audit.terms.filter((t) => compare(t.term, this.liveTerm) < 0).sort((a, b) => compare(a.term, b.term));
  }

  get nowIndex(): number {
    return this.history.length;
  }

  get audit(): DegreeAudit {
    return this.input.audit;
  }

  get plan(): Plan | null {
    return this.input.plan;
  }

  termAt(index: number): Term {
    return index === this.nowIndex ? this.liveTerm : this.history[index]!.term;
  }

  name(code: string, lang: Lang): string {
    const info = this.courses.get(code);
    if (info) return lang === 'en' ? (info.coverage.nameEn ?? info.coverage.nameVi) : info.coverage.nameVi;
    return this.attempts.get(code)?.[0]?.courseName ?? code;
  }

  colourOf(code: string): Colour {
    return this.courses.get(code)?.row?.colour ?? 'none';
  }

  private failedAttempt(r: TranscriptRow): boolean {
    if (r.result === 'fail') return true;
    return this.input.audit.terms.find((t) => sameTerm(t.term, r.term))?.failedCourseCodes.includes(r.courseCode) ?? false;
  }

  private passedAttempt(r: TranscriptRow): boolean {
    return r.result !== 'in_progress' && !this.failedAttempt(r);
  }

  private attemptsBy(code: string, term: Term): TranscriptRow[] {
    return (this.attempts.get(code) ?? []).filter((r) => compare(r.term, term) <= 0);
  }

  private retaken(code: string): boolean {
    return (this.attempts.get(code) ?? []).some((r) => this.failedAttempt(r));
  }

  private line(code: string, lang: Lang, grade: number | null): CourseLine {
    return { code, name: this.name(code, lang), credits: this.courses.get(code)?.credits ?? 0, grade, retaken: this.retaken(code) };
  }

  snapshot(index: number, lang: Lang): Snapshot {
    const live = index === this.nowIndex;
    const term = this.termAt(index);
    const rows = this.rows.map((row) => (live ? this.liveRow(row, lang) : this.pastRow(row, term, lang)));
    return {
      index,
      live,
      term,
      summary: live ? null : this.history[index]!,
      rows,
      passed: live ? this.input.audit.credits.towardTotal : this.passedBy(term),
      courses: live ? this.inProgressCourses(lang) : this.termCourses(term, lang),
    };
  }

  private liveRow(row: Row, lang: Lang): RowState {
    const groups = this.input.audit.groups.filter((g) => row.groupIds.includes(g.id));
    const combined = this.input.audit.combinedMinimums.find((c) => c.id === row.key);
    const d = combined ? combined.credits : groups.reduce((t, g) => t + g.passedCredits + g.overflowInCredits, 0);
    const c = combined ? combined.inProgressCredits : groups.reduce((t, g) => t + g.inProgressCredits, 0);
    const left = combined ? combined.remainingCredits : (groups[0]?.remainingCredits ?? Math.max(0, row.required - d - c));
    const status = (code: string) => this.courses.get(code)?.coverage.status;
    const of = (s: string) => row.codes.filter((code) => status(code) === s);
    return this.withTodo(row, lang, {
      d,
      c,
      left,
      cur: of('in_progress').map((code) => this.line(code, lang, null)),
      fail: of('failed').filter((code) => !this.placed.has(code)).map((code) => this.line(code, lang, this.lastGrade(code))),
      done: of('passed').map((code) => this.line(code, lang, this.courses.get(code)!.coverage.grade)),
      todoCodes: [...of('not_taken'), ...of('failed').filter((code) => this.placed.has(code))],
    });
  }

  private pastRow(row: Row, term: Term, lang: Lang): RowState {
    const passed = row.codes.filter((code) => this.attemptsBy(code, term).some((r) => this.passedAttempt(r)));
    const failed = row.codes.filter((code) => !passed.includes(code) && this.attemptsBy(code, term).some((r) => this.failedAttempt(r)));
    const d = passed.reduce((t, code) => t + (this.courses.get(code)?.credits ?? 0), 0);
    return this.withTodo(row, lang, {
      d,
      c: 0,
      left: Math.max(0, row.required - d),
      cur: [],
      fail: failed.map((code) => this.line(code, lang, this.lastGrade(code, term))),
      done: passed.map((code) => this.line(code, lang, this.passingGrade(code, term))),
      todoCodes: row.codes.filter((code) => !passed.includes(code) && !failed.includes(code)),
    });
  }

  private withTodo(row: Row, lang: Lang, s: Omit<RowState, 'row' | 'todo' | 'unplaced'> & { todoCodes: string[] }): RowState {
    const byTerm = new Map<string, TodoTerm>();
    const add = (term: Term, item: CourseLine | { slot: true; credits: number }) => {
      const k = termKey(term);
      const entry = byTerm.get(k) ?? { term, credits: 0, lines: [] };
      entry.lines.push(item);
      entry.credits += item.credits;
      byTerm.set(k, entry);
    };
    for (const code of s.todoCodes) {
      const term = this.placed.get(code);
      if (term) add(term, this.line(code, lang, null));
    }
    for (const t of this.input.plan?.terms ?? []) {
      for (const p of t.placements) {
        if (p.kind === 'slot' && p.requirementGroupId && row.groupIds.includes(p.requirementGroupId)) add(t.term, { slot: true, credits: p.credits ?? 0 });
      }
    }
    const todo = [...byTerm.values()].sort((a, b) => compare(a.term, b.term));
    const placedCredits = sum(todo);
    const { todoCodes: _, ...rest } = s;
    return { row, ...rest, todo, unplaced: Math.max(0, s.left - placedCredits) };
  }

  private lastGrade(code: string, term?: Term): number | null {
    const list = term ? this.attemptsBy(code, term) : (this.attempts.get(code) ?? []);
    return [...list].reverse().find((r) => this.failedAttempt(r))?.grade ?? null;
  }

  private passingGrade(code: string, term: Term): number | null {
    return [...this.attemptsBy(code, term)].reverse().find((r) => this.passedAttempt(r))?.grade ?? null;
  }

  passedBy(term: Term): number {
    let total = 0;
    for (const [code, list] of this.attempts) {
      const pass = list.find((r) => compare(r.term, term) <= 0 && this.passedAttempt(r));
      if (pass) total += this.courses.get(code)?.credits ?? pass.credits;
    }
    return total;
  }

  private inProgressCourses(lang: Lang): TermCourse[] {
    const rows = this.input.transcript.filter((r) => r.result === 'in_progress' && sameTerm(r.term, this.liveTerm));
    return rows.map((r) => this.termCourse(r, lang, false));
  }

  private termCourses(term: Term, lang: Lang): TermCourse[] {
    return this.input.transcript.filter((r) => sameTerm(r.term, term)).map((r) => this.termCourse(r, lang, this.failedAttempt(r)));
  }

  private termCourse(r: TranscriptRow, lang: Lang, failed: boolean): TermCourse {
    const row = this.courses.get(r.courseCode)?.row ?? null;
    return { code: r.courseCode, name: this.name(r.courseCode, lang), credits: r.credits, colour: row?.colour ?? 'none', rowHash: row?.hash ?? null, grade: r.grade ?? null, failed };
  }

  strip(lang: Lang): StripTerm[] {
    const cell = (code: string, credits: number, state: CellState): StripCell => ({ code, name: this.name(code, lang), credits, colour: this.colourOf(code), state });
    const past = this.history.map((summary, index) => {
      const cells = this.input.transcript.filter((r) => sameTerm(r.term, summary.term)).map((r) => cell(r.courseCode, r.credits, this.failedAttempt(r) ? 'fail' : 'done'));
      return { term: summary.term, index, now: false, cells, credits: sum(cells) };
    });
    const nowCells = this.inProgressCourses(lang).map((c) => cell(c.code, c.credits, 'cur'));
    const now = { term: this.liveTerm, index: this.nowIndex, now: true, cells: nowCells, credits: sum(nowCells) };
    const future = (this.input.plan?.terms ?? [])
      .filter((t) => compare(t.term, this.liveTerm) > 0)
      .sort((a, b) => compare(a.term, b.term))
      .map((t) => {
        const cells = t.placements.flatMap((p): StripCell[] => {
          if (p.kind === 'slot') {
            const row = this.rows.find((r) => p.requirementGroupId && r.groupIds.includes(p.requirementGroupId));
            return [{ code: '', name: '', credits: p.credits ?? 0, colour: row?.colour ?? 'none', state: 'todo' }];
          }
          const info = p.courseCode ? this.courses.get(p.courseCode) : undefined;
          return info && info.coverage.status !== 'passed' && info.coverage.status !== 'in_progress' ? [cell(info.code, info.credits, 'todo')] : [];
        });
        return { term: t.term, index: null, now: false, cells, credits: sum(cells) };
      });
    return [...past, now, ...future].filter((t) => t.now || t.cells.length > 0);
  }

  expectedGraduation(): Term | null {
    const used = (this.input.plan?.terms ?? []).filter((t) => t.placements.length > 0).map((t) => t.term);
    return used.sort(compare).pop() ?? null;
  }

  slotCredits(): number {
    return (this.input.plan?.terms ?? []).flatMap((t) => t.placements).reduce((total, p) => total + (p.kind === 'slot' ? (p.credits ?? 0) : 0), 0);
  }
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
      if (n > 0) parts.push({ state, kind, n });
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
