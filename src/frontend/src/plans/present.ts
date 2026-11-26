import { computed, shallowRef, type Ref } from 'vue';
import { statusOf } from '../api.js';
import { useAsyncLoad } from '../async-load.js';
import { fetchAudit, type DegreeAudit } from '../audit/api.js';
import { fetchCurriculum, type CurriculumCourse, type RequirementGroup } from '../curriculum/api.js';
import { courseName, groupColour, orderGroups } from '../curriculum/present.js';
import { GROUPS, groupClass, type GroupId } from '../groups.js';
import { LANGUAGES, useLocale, useMessages } from '../locale.js';
import type { IconName } from '../shell/icons.js';
import { useTranscriptCodes } from '../transcript/codes.js';
import { currentTermNow, termKey, termName, type Term } from '../terms.js';
import type { Plan, PlanIssue, PlanIssueCode, PlanIssueKind, PlanTermLoad } from './api.js';
import { compareTerms, findTile, isHome, type AttachedIssues, type Board, type Moving, type Row, type Tile } from './board.js';
import { PLANNER_MESSAGES, type IssueContext } from './messages.js';
import type { RowPreview } from './session.js';

export const ISSUE_KINDS_SHOWN = ['violation', 'flag', 'unknown'] as const satisfies readonly PlanIssueKind[];

export const KIND_STYLE: Record<PlanIssueKind, { icon: IconName; tone: 'bad' | 'warn' | 'line' }> = {
  violation: { icon: 'alert', tone: 'bad' },
  flag: { icon: 'info', tone: 'warn' },
  unknown: { icon: 'info', tone: 'line' },
};

export function strongest(issues: readonly PlanIssue[] | undefined): PlanIssueKind | null {
  for (const kind of ISSUE_KINDS_SHOWN) if (issues?.some((issue) => issue.kind === kind)) return kind;
  return null;
}

export const BAR_CODES: ReadonlySet<PlanIssueCode> = new Set(['load_above_maximum', 'load_below_minimum']);

export const METER_HEADROOM_CREDITS = 6;

const GRADE_DECIMALS = 1;

export interface CourseInfo {
  course: CurriculumCourse;
  colour: GroupId;
}

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
  tip: string;
  classes: string[];
  bad: boolean;
  issues: PlanIssue[];
  unknowns: PlanIssueCode[];
}

export interface Placeholder {
  title: string;
  credits: number | null;
  colour: GroupId | null;
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
  cap: 'under' | 'over' | 'ok' | '';
  tone: string;
  drop: { tone: string; reason: string } | null;
  placeholder: Placeholder | null;
  issues: PlanIssue[];
  tiles: TileView[];
}

export function capOf(issues: readonly PlanIssue[], credits: number): RowView['cap'] {
  if (issues.some((i) => i.code === 'load_above_maximum')) return 'over';
  if (issues.some((i) => i.code === 'load_below_minimum')) return 'under';
  return credits > 0 ? 'ok' : '';
}

export function toneOf(issues: readonly PlanIssue[]): string {
  const kind = strongest(issues.filter((i) => i.kind !== 'unknown'));
  return kind ? `has-${kind}` : '';
}

export function meter(load: PlanTermLoad | null, base: number): RowView['meter'] {
  if (!load?.caps) return null;
  const scale = load.caps.max + METER_HEADROOM_CREDITS;
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

export function commonestCredits(group: RequirementGroup): number {
  const counts = new Map<number, number>();
  for (const c of group.courses) counts.set(c.credits, (counts.get(c.credits) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0];
}

export function usePlanCourses(plan: Ref<Plan | null>) {
  const locale = useLocale();
  const m = useMessages(PLANNER_MESSAGES);
  const nameOf = (term: Term) => termName(term, locale.lang);

  const curriculum = useAsyncLoad(
    'the curriculum of the plan',
    async () => {
      const c = plan.value?.curriculum;
      return c ? fetchCurriculum(c.programCode, c.cohortYear) : null;
    },
    () => plan.value?.curriculum.id ?? null,
  );
  const requirementGroups = computed<readonly RequirementGroup[]>(() => curriculum.data.value?.requirementGroups ?? []);
  const catalog = computed(() => {
    const courses = new Map<string, CourseInfo>();
    for (const group of orderGroups(requirementGroups.value)) {
      const colour = groupColour(group);
      for (const course of group.courses) if (!courses.has(course.code)) courses.set(course.code, { course, colour });
    }
    return courses;
  });
  const groupNames = computed(() => new Map(requirementGroups.value.map((g) => [g.id, g])));
  const colourOf = (code: string): GroupId => catalog.value.get(code)?.colour ?? 'core';
  const slotOffers = computed(() =>
    requirementGroups.value
      .filter((g) => g.kind === 'elective' && g.courses.length > 0)
      .map((g) => ({ group: g, colour: groupColour(g), credits: commonestCredits(g) })),
  );

  const transcriptCodes = useTranscriptCodes('the planner');

  const audit = shallowRef<DegreeAudit | null>(null);
  fetchAudit()
    .then((outcome) => (audit.value = outcome.status === 'ready' ? outcome.audit : null))
    .catch((e) => statusOf(e) === 401 || console.error('Loading the audit for the planner failed:', e));
  const auditCourses = computed(() => audit.value?.groups.flatMap((g) => g.courses) ?? []);
  const passed = computed(() => auditCourses.value.filter((c) => c.status === 'passed'));
  const passedCodes = computed(() => new Set(passed.value.map((c) => c.code)));
  const gradeOf = computed(() => new Map(auditCourses.value.filter((c) => c.grade !== null).map((c) => [c.code, c.grade!])));

  const past = computed(() => {
    const now = currentTermNow();
    const terms = audit.value?.terms.filter((t) => compareTerms(t.term, now) < 0) ?? [];
    if (!audit.value || terms.length === 0) return null;
    return {
      span: m.value.pastTerms(terms.length, nameOf(terms[0]!.term), nameOf(terms.at(-1)!.term)),
      accumulated: audit.value.credits.accumulated,
      courses: passed.value.map((c) => ({ code: c.code, name: courseName(c, locale.lang), colour: colourOf(c.code) })),
    };
  });

  const inProgressNow = computed(() => {
    const now = currentTermNow();
    const term = audit.value?.terms.find((t) => compareTerms(t.term, now) === 0);
    return (term?.inProgressCourseCodes ?? []).map((code) => {
      const info = catalog.value.get(code);
      return { code, name: info ? courseName(info.course, locale.lang) : null, credits: info?.course.credits ?? null, colour: colourOf(code) };
    });
  });

  return { curriculum, requirementGroups, catalog, groupNames, slotOffers, transcriptCodes, passedCodes, gradeOf, past, inProgressNow };
}

export type PlanCourses = ReturnType<typeof usePlanCourses>;

export interface PlanViewSources {
  board: Ref<Board>;
  issues: Ref<AttachedIssues | null>;
  courses: Pick<PlanCourses, 'catalog' | 'groupNames' | 'gradeOf' | 'inProgressNow'>;
  moving: Ref<Moving | null>;
  previews: Ref<Map<string, RowPreview>>;
  lifted: Ref<{ key: number; target: number } | null>;
  dropRow: Ref<string | null>;
}

export function usePlanView({ board, issues, courses, moving, previews, lifted, dropRow }: PlanViewSources) {
  const locale = useLocale();
  const m = useMessages(PLANNER_MESSAGES);
  const { catalog, groupNames, gradeOf, inProgressNow } = courses;

  const nameOf = (term: Term) => termName(term, locale.lang);
  const shortName = (colour: GroupId) => GROUPS.find((g) => g.id === colour)!.short[locale.lang];
  const glyphOf = (colour: GroupId) => GROUPS.find((g) => g.id === colour)!.glyph;
  const gradeText = (n: number) => n.toLocaleString(LANGUAGES[locale.lang].tag, { maximumFractionDigits: GRADE_DECIMALS });
  const slotTitle = (groupId: string | null | undefined) => m.value.slot(groupNames.value.get(groupId ?? '')?.name ?? m.value.slotGroupUnknown);

  function tileTitle(tile: Tile): string {
    const p = tile.placement;
    if (p.kind === 'course') return p.courseCode ?? '?';
    return slotTitle(p.requirementGroupId);
  }
  function movingTitle(what: Moving): string {
    if ('code' in what) return what.code;
    if ('slot' in what) return slotTitle(what.slot);
    const found = findTile(board.value, what.key);
    return found ? tileTitle(found.row.tiles[found.index]!) : '';
  }

  const ctx = computed<IssueContext>(() => ({
    requirementName: (issue: PlanIssue) => {
      const coverage = issues.value?.report.coverage;
      if (issue.requirementGroupId) return coverage?.groups.find((g) => g.id === issue.requirementGroupId)?.name ?? null;
      if (issue.combinedMinimumId) return coverage?.combinedMinimums.find((c) => c.id === issue.combinedMinimumId)?.name ?? null;
      return null;
    },
  }));
  const issueText = (issue: PlanIssue) => m.value.issue[issue.code](issue, ctx.value);

  const movingHome = (key: string) => !!moving.value && isHome(board.value, moving.value, key);
  const hoverKey = computed(() => {
    if (dropRow.value) return dropRow.value;
    const l = lifted.value;
    return l ? termKey(board.value[l.target]!.term) : null;
  });
  const hoverPreview = computed(() => (hoverKey.value ? (previews.value.get(hoverKey.value) ?? null) : null));
  const panelPreview = computed(() => {
    const what = moving.value;
    const key = hoverKey.value;
    const row = key ? board.value.find((r) => termKey(r.term) === key) : undefined;
    if (!what || !row || movingHome(key!)) return null;
    return { label: m.value.previewOf(movingTitle(what), nameOf(row.term)), attached: hoverPreview.value?.attached ?? null };
  });

  function tileColour(tile: Tile): GroupId | null {
    const p = tile.placement;
    if (p.kind === 'slot') {
      const group = groupNames.value.get(p.requirementGroupId ?? '');
      return group ? groupColour(group) : null;
    }
    return (p.courseCode && catalog.value.get(p.courseCode)?.colour) || null;
  }

  function tileView(tile: Tile, termName: string): TileView {
    const p = tile.placement;
    const info = p.courseCode ? catalog.value.get(p.courseCode) : undefined;
    const colour = tileColour(tile);
    const all = issues.value?.byTile.get(tile.key) ?? [];
    const title = tileTitle(tile);
    const grade = p.courseCode ? gradeOf.value.get(p.courseCode) : undefined;
    const tone = toneOf(all);
    const shown = [...all.filter((i) => i.kind === 'violation'), ...all.filter((i) => i.kind === 'flag')];
    const unknowns = all.filter((i) => i.kind === 'unknown').map((i) => i.code);
    const tip = [...shown.map((i) => `${m.value.kinds[i.kind]}: ${issueText(i)}`), ...(unknowns.length ? [m.value.unknownWhat(unknowns)] : [])].join('\n');
    return {
      tile,
      title,
      label: m.value.tileLabel(title, termName),
      credits: p.kind === 'slot' ? (p.credits ?? null) : (info?.course.credits ?? null),
      name: info ? courseName(info.course, locale.lang) : null,
      group: colour ? shortName(colour) : null,
      slot: p.kind === 'slot',
      taken: grade === undefined ? null : m.value.takenBefore(gradeText(grade)),
      colour,
      tip,
      classes: ['ptile', colour ? groupClass(colour) : 'g-none', p.kind === 'slot' ? 'slot' : '', tone],
      bad: tone === 'has-violation',
      issues: shown,
      unknowns,
    };
  }

  const DROP_TONE: Record<PlanIssueKind, string> = { violation: 'bad-drop', flag: 'warn-drop', unknown: 'unknown-drop' };

  function dropOf(key: string): RowView['drop'] {
    if (!moving.value) return null;
    if (movingHome(key)) return { tone: 'home', reason: '' };
    const p = previews.value.get(key);
    if (!p) return null;
    if (p.status === 'loading') return { tone: 'checking', reason: m.value.dropChecking };
    if (p.status === 'failed') return { tone: 'failed-drop', reason: m.value.dropFailed };
    const v = p.verdict;
    if (!v) return null;
    if (!v.kind) return { tone: 'ok-drop', reason: '' };
    const tone = DROP_TONE[v.kind];
    const first = v.issues.find((i) => !BAR_CODES.has(i.code));
    if (!first) return { tone, reason: '' };
    const text = issueText(first);
    return { tone, reason: first.kind === 'unknown' ? m.value.dropUnknown(text) : text };
  }

  const movingInfo = computed<Placeholder | null>(() => {
    const what = moving.value;
    if (!what) return null;
    if ('code' in what) {
      const info = catalog.value.get(what.code);
      return { title: what.code, credits: info?.course.credits ?? null, colour: info?.colour ?? null };
    }
    if ('slot' in what) {
      const group = groupNames.value.get(what.slot);
      return { title: movingTitle(what), credits: what.credits, colour: group ? groupColour(group) : null };
    }
    const found = findTile(board.value, what.key);
    if (!found) return null;
    const view = tileView(found.row.tiles[found.index]!, '');
    return { title: view.title, credits: view.credits, colour: view.colour };
  });

  const placeholderIn = (key: string) => (dropRow.value === key && !movingHome(key) ? movingInfo.value : null);

  function previewedLoad(key: string, base: PlanTermLoad | null): PlanTermLoad | null {
    const attached = hoverPreview.value?.attached;
    if (!attached) return null;
    return attached.loads.get(key) ?? (base ? { ...base, credits: 0 } : null);
  }

  function rowView(row: Row): RowView {
    const key = termKey(row.term);
    const name = nameOf(row.term);
    const rowIssues = issues.value?.byTerm.get(key) ?? [];
    const base = issues.value?.loads.get(key) ?? null;
    const previewed = previewedLoad(key, base);
    const load = previewed ?? base;
    const baseCredits = base?.credits ?? 0;
    const capIssues = previewed ? (hoverPreview.value?.attached?.byTerm.get(key) ?? []) : rowIssues;
    return {
      row,
      key,
      name,
      summer: load?.kind === 'summer',
      now: compareTerms(row.term, currentTermNow()) === 0 && inProgressNow.value.length > 0,
      when: m.value.termMonths(row.term),
      load: load && {
        atLeast: rowIssues.some((i) => i.code === 'load_not_checked'),
        caps: load.caps ? m.value.caps(load.caps.min, load.caps.max) : m.value.capsUnknown,
        credits: load.credits,
        max: load.caps?.max ?? null,
        delta: previewed ? load.credits - baseCredits : 0,
      },
      meter: meter(load, baseCredits),
      cap: capOf(capIssues, load?.credits ?? 0),
      tone: toneOf(rowIssues),
      drop: dropOf(key),
      placeholder: placeholderIn(key),
      issues: rowIssues,
      tiles: row.tiles.map((tile) => tileView(tile, name)),
    };
  }
  const rows = computed(() => board.value.map(rowView));

  return { nameOf, shortName, glyphOf, tileTitle, ctx, hoverKey, panelPreview, dropOf, rows };
}
