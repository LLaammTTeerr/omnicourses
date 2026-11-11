<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { RouterLink } from 'vue-router';
import { HttpError, statusOf } from '../api.js';
import { useAsyncLoad } from '../async-load.js';
import { fetchAudit, type DegreeAudit } from '../audit/api.js';
import { useAuth } from '../auth/store.js';
import { fetchCurriculum, type CurriculumCourse, type RequirementGroup } from '../curriculum/api.js';
import { courseName, groupColour, matches, orderGroups } from '../curriculum/present.js';
import { GROUPS, groupClass, type GroupId } from '../groups.js';
import { useLocale, useMessages } from '../locale.js';
import { useOnboarding } from '../onboarding/store.js';
import { usePageTitle } from '../page-title.js';
import Icon from '../shell/Icon.vue';
import { useToast } from '../shell/toast.js';
import { useTranscriptCodes } from '../transcript/codes.js';
import { currentTerm, termKey, termName, vietnamDate, type Term } from '../terms.js';
import { fetchPlan, fetchPlanIssues, previewPlanIssues, savePlacements, type Plan, type PlanIssue, type PlanIssueCode, type PlanTermLoad } from './api.js';
import {
  addCourse,
  addSlot,
  attachIssues,
  boardBody,
  boardOf,
  boardWith,
  compareTerms,
  dropVerdict,
  findTile,
  moveTile,
  nextTerm,
  placedCodes,
  PREVIEW_KEY,
  removeTile,
  rowsFor,
  sameTiles,
  withNextRow,
  type AttachedIssues,
  type Board,
  type DropVerdict,
  type Moving,
  type Row,
  type Tile,
} from './board.js';
import { edgeScroller, play, snapshot } from './flip.js';
import IssuesPanel from './IssuesPanel.vue';
import { PLANNER_MESSAGES, type IssueContext } from './messages.js';
import PlanTabs from './PlanTabs.vue';
import { KIND_STYLE, strongest } from './present.js';
import StatusStrip from './StatusStrip.vue';

// The plan editor (F5, UC-05): one row per term, the curriculum's courses to add, and moves by button, keyboard
// (Space, arrows, Enter, Escape: UC-05 A1) or drag and drop. Each change saves the whole board (ADR 0014), then the
// rule engine's report is read again from GET /plans/{id}/issues. While a course is dragged or lifted, the editor asks
// the engine about the board with the drop made (POST /plans/{id}/issues, which saves nothing), so each row can say
// before the drop whether it would break a rule and what its load would be. The editor never judges a placement, a
// load or a requirement itself (AGENTS.md hard rule 1): colours, loads, caps and reasons come only from those reports.
// A report is pinned to the board it was computed for, so its issues follow their tiles, and they are dimmed while
// the board on screen holds other tiles than that one.
const props = defineProps<{ id: string }>();
const auth = useAuth();
const onboarding = useOnboarding();
const locale = useLocale();
const toast = useToast();
const m = useMessages(PLANNER_MESSAGES);

const plan = shallowRef<Plan | null>(null);
/** The board on screen. */
const board = shallowRef<Board>([]);
/** The board the API last saved. */
const saved = shallowRef<Board>([]);
/** The tile lifted with the keyboard, and the row it would drop on. */
const lifted = shallowRef<{ key: number; target: number } | null>(null);
let nextKey = 0;
const newKey = () => nextKey++;
const currentTermNow = () => currentTerm(vietnamDate(new Date()));

/**
 * The plan this editor has open. The router reuses the editor when the student goes from one plan straight to
 * another, so each load opens a new one, and a save or check started for an earlier one stops instead of touching
 * the plan now on screen.
 */
interface Opened {
  id: string;
  saving: boolean;
}
let opened: Opened = { id: props.id, saving: false };

// ---------- The rule engine's report ----------
const issues = shallowRef<AttachedIssues | null>(null);
const issuesStatus = ref<'loading' | 'failed' | 'idle'>('loading');
let checkCall = 0;

async function check(snapshotBoard: Board): Promise<void> {
  const call = ++checkCall;
  const { id } = opened;
  issuesStatus.value = 'loading';
  try {
    const report = await auth.authed((token) => fetchPlanIssues(token, id));
    if (call !== checkCall) return;
    issues.value = attachIssues(snapshotBoard, report);
    issuesStatus.value = 'idle';
  } catch (e) {
    if (call !== checkCall) return;
    if (statusOf(e) !== 401) console.error('Checking the plan failed:', e);
    issuesStatus.value = 'failed';
  }
}
/** The Issues panel's retry. During a save it waits: the loop checks when it ends, after the last PUT. */
function retryCheck(): void {
  if (!opened.saving) void check(saved.value);
}
/** The report describes the board on screen. Empty rows do not count: they are not saved, so not checked either. */
const fresh = computed(() => issues.value !== null && sameTiles(issues.value.board, board.value));

// ---------- Saving ----------
const saveState = ref<'saved' | 'saving' | 'failed'>('saved');
const saveError = ref<string | null>(null);

/**
 * Saves the board on screen until the API holds it, then checks the saved board, also after a failure, which puts
 * back the last saved board (an earlier request of the same loop may have gone through). If the student opens
 * another plan meanwhile, the request in flight still lands in this one and the loop stops there: a change not yet
 * sent is dropped rather than written into the plan now open.
 */
async function save(): Promise<void> {
  const mine = opened;
  if (mine.saving) return;
  mine.saving = true;
  saveState.value = 'saving';
  try {
    for (;;) {
      const sending = board.value;
      if (sameTiles(sending, saved.value)) {
        saved.value = sending; // Same tiles, maybe more empty rows: keep them if a later save fails.
        break;
      }
      // A check asked for before this PUT may be answered after it commits, about this board and not its snapshot:
      // drop it. The loop checks again when it ends.
      ++checkCall;
      if (issuesStatus.value === 'loading') issuesStatus.value = 'idle';
      const updated = await auth.authed((token) => savePlacements(token, mine.id, boardBody(sending)));
      if (mine !== opened) return;
      plan.value = updated;
      saved.value = sending;
    }
    saveState.value = 'saved';
    void check(saved.value);
  } catch (e) {
    if (mine !== opened) return;
    animate(() => (board.value = saved.value));
    // A lifted tile's target row may be gone, or the tile may be back in another row.
    lifted.value = null;
    const code = statusOf(e);
    saveState.value = code === 401 ? 'saved' : 'failed';
    if (code === 401) return; // App.vue takes the student to sign in.
    console.error('Saving the plan failed:', e);
    const details = e instanceof HttpError ? e.details.join('; ') : '';
    saveError.value = code === 400 && details ? m.value.saveRefused(details) : m.value.saveFailed;
    void check(saved.value);
  } finally {
    mine.saving = false;
  }
}

// ---------- Changes, their animation and undo ----------
const boardEl = ref<HTMLElement | null>(null);
/** Runs a change of the board, then lets each tile glide from where it was (flip.ts). */
function animate(fn: () => void): void {
  const before = snapshot(boardEl.value);
  fn();
  void nextTick(() => play(boardEl.value, before));
}

/** The boards before each change, newest last, with what the change was, for Undo (Ctrl+Z). */
const history = shallowRef<{ board: Board; said: string }[]>([]);
const HISTORY_MAX = 50;

function change(next: Board, said?: string, undoing = false): void {
  if (next === board.value) return;
  if (!undoing) history.value = [...history.value.slice(1 - HISTORY_MAX), { board: board.value, said: said ?? '' }];
  animate(() => (board.value = next));
  saveError.value = null;
  if (said) announce(said);
  void save();
}

function undo(): void {
  const last = history.value.at(-1);
  if (!last) {
    toast.show(m.value.nothingToUndo);
    return;
  }
  history.value = history.value.slice(0, -1);
  lifted.value = null;
  const said = m.value.undone(last.said);
  change(last.board, said, true);
  toast.show(said);
}

function onWindowKey(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z' || event.shiftKey) return;
  const target = event.target as HTMLElement | null;
  if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
  event.preventDefault();
  undo();
}

// ---------- Loading ----------
const loaded = useAsyncLoad(
  'the plan',
  async () => {
    const mine: Opened = (opened = { id: props.id, saving: false });
    ++checkCall;
    issues.value = null;
    saveState.value = 'saved';
    saveError.value = null;
    lifted.value = null;
    history.value = [];
    const found = await auth.authed((token) => fetchPlan(token, mine.id));
    // The rows run to the target graduation term; without onboarding answers they stop at the plan's last term.
    const target = await onboarding.load().then(
      (answers) => answers.targetGraduationTerm,
      () => null,
    );
    // A later load owns the editor now; useAsyncLoad drops this answer too.
    if (mine !== opened) return found;
    endDrag();
    lifted.value = null;
    const start = boardOf(found.terms, rowsFor(found.terms, currentTermNow(), target), newKey);
    plan.value = found;
    board.value = start;
    saved.value = start;
    addTarget.value = termKey(start.find((row) => compareTerms(row.term, currentTermNow()) >= 0)?.term ?? start[0]!.term);
    void check(start);
    return found;
  },
  () => props.id,
);

// ---------- What a tile shows ----------
interface CourseInfo {
  course: CurriculumCourse;
  colour: GroupId;
}
const curriculum = useAsyncLoad(
  'the curriculum of the plan',
  async () => {
    const c = plan.value?.curriculum;
    return c ? auth.authed((token) => fetchCurriculum(token, c.programCode, c.cohortYear)) : null;
  },
  () => plan.value?.curriculum.id ?? null,
);
const requirementGroups = computed<readonly RequirementGroup[]>(() => curriculum.data.value?.requirementGroups ?? []);
/** Each course of the curriculum once, in the group order of the explorer. */
const catalog = computed(() => {
  const courses = new Map<string, CourseInfo>();
  for (const group of orderGroups(requirementGroups.value)) {
    const colour = groupColour(group);
    for (const course of group.courses) if (!courses.has(course.code)) courses.set(course.code, { course, colour });
  }
  return courses;
});
const groupNames = computed(() => new Map(requirementGroups.value.map((g) => [g.id, g])));
const shortName = (colour: GroupId) => GROUPS.find((g) => g.id === colour)!.short[locale.lang];
// A neutral mark on the courses of the student's saved transcript, as in the explorer: whether one counts as passed
// is the engine's call (it flags a placed one as already_passed). No transcript, or none loaded, shows no marks.
const transcriptCodes = useTranscriptCodes('the planner');

// The degree audit (the rule engine's reading of the transcript, F3): the terms already taken, the courses it counts
// as passed or in progress, and their grades. Without one (no transcript, no onboarding, a failure) none of it shows.
const audit = shallowRef<DegreeAudit | null>(null);
auth
  .authed(fetchAudit)
  .then((outcome) => (audit.value = outcome.status === 'ready' ? outcome.audit : null))
  .catch((e) => statusOf(e) === 401 || console.error('Loading the audit for the planner failed:', e));
const auditCourses = computed(() => audit.value?.groups.flatMap((g) => g.courses) ?? []);
const passedCodes = computed(() => new Set(auditCourses.value.filter((c) => c.status === 'passed').map((c) => c.code)));
const gradeOf = computed(() => new Map(auditCourses.value.filter((c) => c.grade !== null).map((c) => [c.code, c.grade!])));
/** The terms before the current one, with what the engine counts as passed, for the "Taken" strip. */
const past = computed(() => {
  const now = currentTermNow();
  const terms = audit.value?.terms.filter((t) => compareTerms(t.term, now) < 0) ?? [];
  if (!audit.value || terms.length === 0) return null;
  const passed = auditCourses.value.filter((c) => c.status === 'passed');
  return {
    span: m.value.pastTerms(terms.length, nameOf(terms[0]!.term), nameOf(terms.at(-1)!.term)),
    accumulated: audit.value.credits.accumulated,
    courses: passed.map((c) => ({ code: c.code, name: courseName(c, locale.lang), colour: catalog.value.get(c.code)?.colour ?? 'core' })),
  };
});
/** The courses the transcript has in progress in the current term: shown in its row, locked. */
const inProgressNow = computed(() => {
  const now = currentTermNow();
  const term = audit.value?.terms.find((t) => compareTerms(t.term, now) === 0);
  return (term?.inProgressCourseCodes ?? []).map((code) => {
    const info = catalog.value.get(code);
    return { code, name: info ? courseName(info.course, locale.lang) : null, credits: info?.course.credits ?? null, colour: info?.colour ?? 'core' };
  });
});

function tileTitle(tile: Tile): string {
  const p = tile.placement;
  if (p.kind === 'course') return p.courseCode ?? '?';
  return m.value.slot(groupNames.value.get(p.requirementGroupId ?? '')?.name ?? m.value.slotGroupUnknown);
}
const movingTitle = (what: Moving) => {
  if ('code' in what) return what.code;
  if ('slot' in what) return m.value.slot(groupNames.value.get(what.slot)?.name ?? m.value.slotGroupUnknown);
  const found = findTile(board.value, what.key);
  return found ? tileTitle(found.row.tiles[found.index]!) : '';
};

const ctx = computed<IssueContext>(() => ({
  requirementName: (issue: PlanIssue) => {
    const coverage = issues.value?.report.coverage;
    if (issue.requirementGroupId) return coverage?.groups.find((g) => g.id === issue.requirementGroupId)?.name ?? null;
    if (issue.combinedMinimumId) return coverage?.combinedMinimums.find((c) => c.id === issue.combinedMinimumId)?.name ?? null;
    return null;
  },
}));

// ---------- The drag preview: the engine's report on the board with the drop made, one per row ----------
interface RowPreview {
  status: 'loading' | 'done' | 'failed';
  attached: AttachedIssues | null;
  verdict: DropVerdict | null;
}
/** What is being dragged with the pointer, or lifted with the keyboard. */
const moving = shallowRef<Moving | null>(null);
const previews = shallowRef<Map<string, RowPreview>>(new Map());
let previewAbort: AbortController | null = null;
let previewOf: Moving | null = null;

const homeOf = (what: Moving) => ('key' in what ? findTile(board.value, what.key)?.row.term : undefined);

/** Asks the engine about the drop of `what` on `term`, once per row while the same thing moves. */
function previewRow(what: Moving, term: Term): void {
  if (previewOf !== what) {
    previewAbort?.abort();
    previewAbort = new AbortController();
    previewOf = what;
    previews.value = new Map();
  }
  const key = termKey(term);
  const home = homeOf(what);
  if (previews.value.has(key) || (home && termKey(home) === key)) return;
  const next = boardWith(board.value, what, term);
  if (next === board.value) return;
  const tileKey = 'key' in what ? what.key : PREVIEW_KEY;
  const set = (value: RowPreview) => {
    if (previewOf !== what) return;
    previews.value = new Map(previews.value).set(key, value);
  };
  set({ status: 'loading', attached: null, verdict: null });
  const { signal } = previewAbort!;
  const { id } = opened;
  auth
    .authed((token) => previewPlanIssues(token, id, boardBody(next), signal))
    .then((report) => {
      const attached = attachIssues(next, report);
      set({ status: 'done', attached, verdict: dropVerdict(attached, tileKey, term) });
    })
    .catch((e) => {
      if (signal.aborted) return;
      if (statusOf(e) !== 401) console.error('Previewing a drop failed:', e);
      set({ status: 'failed', attached: null, verdict: null });
    });
}
function previewAll(what: Moving): void {
  for (const row of board.value) previewRow(what, row.term);
}
function stopPreview(): void {
  previewAbort?.abort();
  previewAbort = null;
  previewOf = null;
  previews.value = new Map();
}

/** The row a drop would land on now: the one under the pointer, or the lifted tile's target. */
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
  if (!what || !row || (homeOf(what) && termKey(homeOf(what)!) === key)) return null;
  return { label: m.value.previewOf(movingTitle(what), nameOf(row.term)), attached: hoverPreview.value?.attached ?? null };
});

// ---------- What each row and tile shows, worked out once per change ----------
interface TileView {
  tile: Tile;
  title: string;
  label: string;
  credits: number | null;
  name: string | null;
  group: string | null;
  slot: boolean;
  taken: string | null;
  classes: string[];
  bad: boolean;
  /** Violations, then flags. */
  issues: PlanIssue[];
  unknowns: PlanIssueCode[];
}
interface RowView {
  row: Row;
  key: string;
  name: string;
  summer: boolean;
  now: boolean;
  load: { text: string; caps: string; credits: number; max: number | null; delta: number } | null;
  meter: { fill: number; from: number; to: number; min: number | null; minLabel: number | null; max: number; maxLabel: number } | null;
  tone: string;
  drop: { tone: string; reason: string } | null;
  issues: PlanIssue[];
  tiles: TileView[];
}

const toneOf = (issues: readonly PlanIssue[]) => {
  const kind = strongest(issues.filter((i) => i.kind !== 'unknown'));
  return kind ? `has-${kind}` : '';
};
const gradeText = (n: number) => n.toLocaleString(locale.lang === 'vi' ? 'vi-VN' : 'en-GB', { maximumFractionDigits: 1 });

function tileView(tile: Tile, termName: string): TileView {
  const p = tile.placement;
  const info = p.courseCode ? catalog.value.get(p.courseCode) : undefined;
  const slotGroup = p.kind === 'slot' ? groupNames.value.get(p.requirementGroupId ?? '') : undefined;
  const colour = info?.colour ?? (slotGroup ? groupColour(slotGroup) : null);
  const all = issues.value?.byTile.get(tile.key) ?? [];
  const title = tileTitle(tile);
  const grade = p.courseCode ? gradeOf.value.get(p.courseCode) : undefined;
  const tone = toneOf(all);
  return {
    tile,
    title,
    label: m.value.tileLabel(title, termName),
    credits: p.kind === 'slot' ? (p.credits ?? null) : (info?.course.credits ?? null),
    name: info ? courseName(info.course, locale.lang) : null,
    group: colour ? shortName(colour) : null,
    slot: p.kind === 'slot',
    taken: grade === undefined ? null : m.value.takenBefore(gradeText(grade)),
    classes: ['ptile', colour ? groupClass(colour) : 'g-none', p.kind === 'slot' ? 'slot' : '', tone],
    bad: tone === 'has-violation',
    issues: [...all.filter((i) => i.kind === 'violation'), ...all.filter((i) => i.kind === 'flag')],
    unknowns: all.filter((i) => i.kind === 'unknown').map((i) => i.code),
  };
}

/** The meter runs a little past the maximum, so a load above it still shows. Drawing only: the engine compares. */
function meter(load: PlanTermLoad | null, base: number): RowView['meter'] {
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

function dropOf(key: string): RowView['drop'] {
  const what = moving.value;
  if (!what) return null;
  const home = homeOf(what);
  if (home && termKey(home) === key) return { tone: 'home', reason: '' };
  const p = previews.value.get(key);
  if (!p) return null;
  if (p.status === 'loading') return { tone: 'checking', reason: m.value.dropChecking };
  if (p.status === 'failed' || !p.verdict) return null;
  const v = p.verdict;
  const first = v.issues[0];
  if (first) return { tone: v.kind === 'violation' ? 'bad-drop' : 'warn-drop', reason: m.value.issue[first.code](first, ctx.value) };
  const load = v.load;
  return { tone: 'ok-drop', reason: load?.caps ? `${m.value.dropOk} · ${m.value.dropLoad(load.credits, load.caps.max)}` : m.value.dropOk };
}

function rowView(row: Row): RowView {
  const key = termKey(row.term);
  const name = nameOf(row.term);
  const rowIssues = issues.value?.byTerm.get(key) ?? [];
  const base = issues.value?.loads.get(key) ?? null;
  // While a drop is previewed, every row shows the load the engine reports for the board with the drop made.
  const previewed = hoverPreview.value?.attached ? (hoverPreview.value.attached.loads.get(key) ?? (base ? { ...base, credits: 0 } : null)) : null;
  const load = previewed ?? base;
  // The engine reports a load with a course of unknown credits as a lower bound (load_not_checked).
  const atLeast = rowIssues.some((i) => i.code === 'load_not_checked');
  const baseCredits = base?.credits ?? 0;
  return {
    row,
    key,
    name,
    summer: load?.kind === 'summer',
    now: compareTerms(row.term, currentTermNow()) === 0 && inProgressNow.value.length > 0,
    load: load && {
      text: atLeast ? m.value.loadAtLeast(load.credits) : m.value.load(load.credits),
      caps: load.caps ? m.value.caps(load.caps.min, load.caps.max) : m.value.capsUnknown,
      credits: load.credits,
      max: load.caps?.max ?? null,
      delta: previewed ? load.credits - baseCredits : 0,
    },
    meter: meter(load, baseCredits),
    tone: toneOf(rowIssues),
    drop: dropOf(key),
    issues: rowIssues,
    tiles: row.tiles.map((tile) => tileView(tile, name)),
  };
}
const rows = computed(() => board.value.map(rowView));

// ---------- Actions ----------
const announcement = ref('');
function announce(text: string): void {
  announcement.value = text;
}
const nameOf = (term: Term) => termName(term, locale.lang);

async function focusTile(key: number): Promise<void> {
  await nextTick();
  document.getElementById(`tile-${key}`)?.focus();
}

function moveBy(tile: Tile, step: -1 | 1): void {
  const found = findTile(board.value, tile.key);
  if (!found) return;
  const to = board.value[board.value.indexOf(found.row) + step];
  if (!to) return;
  change(moveTile(board.value, tile.key, to.term), m.value.moved(tileTitle(tile), nameOf(to.term)));
  void focusTile(tile.key);
}

function remove(tile: Tile): void {
  change(removeTile(board.value, tile.key), m.value.removed(tileTitle(tile)));
  void nextTick(() => document.getElementById('course-search')?.focus());
}

const query = ref('');
const poolGroup = ref<GroupId | ''>('');
const addTarget = ref('');
const addTargetTerm = computed(() => board.value.find((row) => termKey(row.term) === addTarget.value)?.term ?? board.value[0]?.term ?? null);
/** The tray: courses not placed, not in progress now, and not counted as passed by the engine's audit. */
const unplaced = computed(() => {
  const placed = placedCodes(board.value);
  const now = new Set(inProgressNow.value.map((c) => c.code));
  return [...catalog.value.values()].filter(({ course }) => !placed.has(course.code) && !now.has(course.code) && !passedCodes.value.has(course.code));
});
const poolGroups = computed(() => [...new Set(unplaced.value.map((c) => c.colour))]);
const shown = computed(() =>
  unplaced.value.filter(({ course, colour }) => (!poolGroup.value || colour === poolGroup.value) && matches(query.value, course.code, course.nameVi, course.nameEn)),
);
/**
 * One slot per elective group (ADR 0014: credits held before a course is chosen), at the credits most of its courses
 * carry. Drawing a default only: how many credits the group still needs is the engine's coverage.
 */
const slotOffers = computed(() =>
  requirementGroups.value
    .filter((g) => g.kind === 'elective' && g.courses.length > 0)
    .map((g) => {
      const counts = new Map<number, number>();
      for (const c of g.courses) counts.set(c.credits, (counts.get(c.credits) ?? 0) + 1);
      const credits = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0];
      return { group: g, colour: groupColour(g), credits };
    }),
);

function add(code: string, to: Term | null = addTargetTerm.value): void {
  if (!to) return;
  change(addCourse(board.value, code, to, newKey()), m.value.added(code, nameOf(to)));
}
function addSlotTo(groupId: string, credits: number, to: Term | null = addTargetTerm.value): void {
  if (!to) return;
  const said = m.value.added(m.value.slot(groupNames.value.get(groupId)?.name ?? m.value.slotGroupUnknown), nameOf(to));
  change(addSlot(board.value, groupId, credits, to, newKey()), said);
}

/** An empty row is not stored (ADR 0014): adding one saves nothing, and a report of the board still describes it. */
function addRow(): void {
  const before = board.value;
  const next = withNextRow(before);
  board.value = next;
  if (saved.value === before) saved.value = next;
}

/** Brings a row into view as the keyboard picks it, as dragging near the edge does for the pointer. */
async function revealRow(index: number): Promise<void> {
  await nextTick();
  const el = boardEl.value?.querySelectorAll<HTMLElement>('.trow')[index];
  if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// Keyboard moves (UC-05 A1): Space lifts the focused tile, the arrows pick a row, Enter or Space drops, Escape cancels.
function onTileKey(event: KeyboardEvent, tile: Tile, rowIndex: number): void {
  if (event.target !== event.currentTarget) return;
  const title = tileTitle(tile);
  const current = lifted.value?.key === tile.key ? lifted.value : null;
  if (current) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const target = Math.max(0, Math.min(board.value.length - 1, current.target + (event.key === 'ArrowUp' ? -1 : 1)));
      lifted.value = { key: tile.key, target };
      announce(m.value.liftTarget(title, nameOf(board.value[target]!.term)));
      if (moving.value) previewRow(moving.value, board.value[target]!.term);
      void revealRow(target);
    } else if (event.key === 'Enter' || event.key === ' ') {
      const to = board.value[current.target]!.term;
      dropLifted();
      if (current.target === rowIndex) announce(m.value.liftCancelled(title));
      else change(moveTile(board.value, tile.key, to), m.value.moved(title, nameOf(to)));
      void focusTile(tile.key);
    } else if (event.key === 'Escape') {
      dropLifted();
      announce(m.value.liftCancelled(title));
    } else return;
    event.preventDefault();
    return;
  }
  if (event.key === ' ') {
    lifted.value = { key: tile.key, target: rowIndex };
    moving.value = { key: tile.key };
    announce(m.value.lifted(title, nameOf(board.value[rowIndex]!.term)));
  } else if (event.key === 'Delete') {
    remove(tile);
  } else return;
  event.preventDefault();
}
function dropLifted(): void {
  lifted.value = null;
  moving.value = null;
  stopPreview();
}
function onTileBlur(tile: Tile): void {
  if (lifted.value?.key === tile.key) dropLifted();
}

// Drag and drop, for a pointer: a tile, a course or a slot of the tray onto a row, or a tile back onto the tray to
// remove it. Near the top or bottom of the window the page scrolls.
const dragging = shallowRef<Moving | null>(null);
const dropRow = ref<string | null>(null);
function startDrag(event: DragEvent, what: Moving): void {
  dragging.value = what;
  moving.value = what;
  lifted.value = null;
  event.dataTransfer?.setData('text/plain', 'key' in what ? String(what.key) : 'code' in what ? what.code : what.slot);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  previewAll(what);
}
function endDrag(): void {
  scroller.stop();
  dragging.value = null;
  dropRow.value = null;
  if (!lifted.value) {
    moving.value = null;
    stopPreview();
  }
}
function overRow(event: DragEvent, term: Term): void {
  if (!dragging.value) return;
  event.preventDefault();
  dropRow.value = termKey(term);
}
function leaveRow(event: DragEvent): void {
  // Crossing into a tile of the same row is not leaving it.
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) dropRow.value = null;
}
function dropOnRow(term: Term): void {
  const what = dragging.value;
  endDrag();
  if (!what) return;
  if ('code' in what) add(what.code, term);
  else if ('slot' in what) addSlotTo(what.slot, what.credits, term);
  else {
    const found = findTile(board.value, what.key);
    if (found) change(moveTile(board.value, what.key, term), m.value.moved(tileTitle(found.row.tiles[found.index]!), nameOf(term)));
  }
}
function overList(event: DragEvent): void {
  if (dragging.value && 'key' in dragging.value) event.preventDefault();
}
function dropOnList(): void {
  const what = dragging.value;
  endDrag();
  if (!what || !('key' in what)) return;
  const found = findTile(board.value, what.key);
  if (found) remove(found.row.tiles[found.index]!);
}
const scroller = edgeScroller();
function onWindowDragOver(event: DragEvent): void {
  if (dragging.value) scroller.move(event.clientY);
}

// ---------- The issues panel, open or collapsed (kept for the next visit) ----------
const RAIL_KEY = 'oc-planner-rail';
const readRail = () => {
  try {
    return localStorage.getItem(RAIL_KEY) === 'mini';
  } catch {
    return false;
  }
};
const collapsed = ref(readRail());
function toggleRail(): void {
  collapsed.value = !collapsed.value;
  try {
    localStorage.setItem(RAIL_KEY, collapsed.value ? 'mini' : 'open');
  } catch {
    // Not kept: private mode or storage blocked.
  }
}

// ---------- What-if: try a change on a copy ----------
const tabs = ref<InstanceType<typeof PlanTabs> | null>(null);
function whatIf(): void {
  if (plan.value) void tabs.value?.copy(m.value.whatIfName(plan.value.name));
}

onMounted(() => {
  window.addEventListener('keydown', onWindowKey);
  window.addEventListener('dragover', onWindowDragOver);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKey);
  window.removeEventListener('dragover', onWindowDragOver);
  scroller.stop();
  stopPreview();
});

usePageTitle(() => plan.value?.name ?? m.value.title);
</script>

<template>
  <div class="page planner-page">
    <header class="page-head">
      <div>
        <p class="crumbs"><RouterLink :to="{ name: 'plans' }">{{ m.allPlans }}</RouterLink></p>
        <h1>{{ plan?.name ?? m.title }}</h1>
        <p>{{ m.editorLead }}</p>
        <p class="small t3 kbd-hint" data-test="keyboard-hint">{{ m.keyboardHint }}</p>
      </div>
      <div v-if="plan" class="head-actions">
        <button class="btn" type="button" :disabled="history.length === 0" title="Ctrl+Z" data-test="undo" @click="undo"><Icon name="left" size="sm" />{{ m.undo }}</button>
        <button class="btn" type="button" :title="m.whatIfHint" data-test="what-if" @click="whatIf"><Icon name="copy" size="sm" />{{ m.whatIf }}</button>
      </div>
    </header>

    <p v-if="loaded.status.value === 'loading'" class="t3">{{ m.loading }}</p>
    <div v-else-if="loaded.status.value === 'failed'" class="callout bad" role="alert">
      <Icon name="alert" />
      <div v-if="statusOf(loaded.error.value) === 404">
        <p>{{ m.notFound }}</p>
        <RouterLink class="btn sm" :to="{ name: 'plans' }">{{ m.allPlans }}</RouterLink>
      </div>
      <div v-else>
        <p>{{ m.loadFailed }}</p>
        <button class="btn sm" type="button" @click="loaded.reload">{{ m.retry }}</button>
      </div>
    </div>

    <template v-else-if="plan">
      <PlanTabs :id="plan.id" ref="tabs" />
      <StatusStrip :attached="issues" :fresh="fresh" :save-state="saveState" />
      <p class="small t3">{{ m.curriculum(plan.curriculum.code) }}</p>
      <p v-if="saveError" class="callout bad" role="alert" data-test="save-error"><Icon name="alert" /><span>{{ saveError }}</span></p>

      <div class="planner-layout" :class="{ 'rail-mini': collapsed }">
        <div ref="boardEl" class="planner-main" :class="{ dragging: !!moving }">
          <section class="card tray" aria-labelledby="tray-title" data-test="tray" :class="{ 'drop-ok': dragging && 'key' in dragging }" @dragover="overList" @drop.prevent="dropOnList">
            <div class="tray-head">
              <h2 id="tray-title">{{ m.courses }}</h2>
              <span v-if="curriculum.status.value === 'loaded'" class="chip">{{ m.coursesCount(unplaced.length) }}</span>
              <div v-if="poolGroups.length > 1" class="pool-chips" role="group" :aria-label="m.groupFilter">
                <button class="chip" type="button" :aria-pressed="poolGroup === ''" data-test="pool-group-all" @click="poolGroup = ''">{{ m.allGroups }}</button>
                <button
                  v-for="g in poolGroups"
                  :key="g"
                  :class="['chip', 'soft', groupClass(g)]"
                  type="button"
                  :aria-pressed="poolGroup === g"
                  :data-test="`pool-group-${g}`"
                  @click="poolGroup = poolGroup === g ? '' : g"
                >
                  {{ shortName(g) }}
                </button>
              </div>
            </div>
            <div class="tray-tools">
              <label class="search">
                <span class="sr-only">{{ m.search }}</span>
                <Icon name="search" size="sm" />
                <input id="course-search" v-model="query" class="input" type="search" :placeholder="m.searchPlaceholder" />
              </label>
              <label class="field add-to">
                <span>{{ m.addTo }}</span>
                <select v-model="addTarget" class="select" data-test="add-to">
                  <option v-for="row in board" :key="termKey(row.term)" :value="termKey(row.term)">{{ nameOf(row.term) }}</option>
                </select>
              </label>
            </div>
            <p v-if="dragging && 'key' in dragging" class="small t2">{{ m.dropToRemove }}</p>
            <p v-if="curriculum.status.value === 'loading'" class="t3">{{ m.loading }}</p>
            <div v-else-if="curriculum.status.value === 'failed'" class="callout warn small" role="alert">
              <Icon name="alert" size="sm" />
              <div>
                <p>{{ statusOf(curriculum.error.value) === 404 ? m.noCurriculum : m.curriculumFailed }}</p>
                <button class="btn sm" type="button" @click="curriculum.reload">{{ m.retry }}</button>
              </div>
            </div>
            <p v-else-if="unplaced.length === 0" class="small t2" role="status">{{ m.allPlaced }}</p>
            <p v-else-if="shown.length === 0" class="small t2" role="status">{{ m.noMatch }}</p>
            <ul v-else class="tray-list">
              <li
                v-for="{ course, colour } in shown"
                :key="course.code"
                :class="['pcourse', groupClass(colour)]"
                draggable="true"
                :data-flip="`pool-${course.code}`"
                :data-test="`pool-${course.code}`"
                @dragstart="startDrag($event, { code: course.code })"
                @dragend="endDrag"
              >
                <span class="top">
                  <span class="k">{{ course.code }}</span>
                  <span class="cr">{{ m.credits(course.credits) }}</span>
                </span>
                <span class="nm">{{ courseName(course, locale.lang) }}</span>
                <span class="sub">
                  <span class="glabel">{{ shortName(colour) }}</span>
                  <span v-if="transcriptCodes.has(course.code)" class="mark" data-test="in-transcript"><Icon name="file" size="sm" />{{ m.inTranscript }}</span>
                </span>
                <button
                  class="btn sm ghost icon-only add-btn"
                  type="button"
                  :aria-label="m.add(course.code, addTargetTerm ? nameOf(addTargetTerm) : '')"
                  :title="m.add(course.code, addTargetTerm ? nameOf(addTargetTerm) : '')"
                  :data-test="`add-${course.code}`"
                  @click="add(course.code)"
                >
                  <Icon name="plus" size="sm" />
                </button>
              </li>
            </ul>
            <div v-if="slotOffers.length && curriculum.status.value === 'loaded'" class="slot-offers">
              <h3 class="xs t3">{{ m.slotsTitle }}</h3>
              <ul class="tray-list">
                <li
                  v-for="s in slotOffers"
                  :key="s.group.id"
                  :class="['pcourse', 'slot', groupClass(s.colour)]"
                  draggable="true"
                  data-test="slot-offer"
                  @dragstart="startDrag($event, { slot: s.group.id, credits: s.credits })"
                  @dragend="endDrag"
                >
                  <span class="top">
                    <span class="k">{{ shortName(s.colour) }}</span>
                    <span class="cr">{{ m.credits(s.credits) }}</span>
                  </span>
                  <span class="nm">{{ s.group.name }}</span>
                  <span class="sub"><span class="glabel">{{ m.slotNotChosen }}</span></span>
                  <button
                    class="btn sm ghost icon-only add-btn"
                    type="button"
                    :aria-label="m.addSlot(s.group.name, addTargetTerm ? nameOf(addTargetTerm) : '')"
                    :title="m.addSlot(s.group.name, addTargetTerm ? nameOf(addTargetTerm) : '')"
                    data-test="add-slot"
                    @click="addSlotTo(s.group.id, s.credits)"
                  >
                    <Icon name="plus" size="sm" />
                  </button>
                </li>
              </ul>
            </div>
          </section>

          <section v-if="past" class="trow past" :aria-label="m.pastTitle" data-test="past">
            <div class="trow-l">
              <div class="tname"><h3>{{ m.pastTitle }}</h3></div>
              <small class="t3">{{ past.span }}</small>
              <p class="tload"><b class="num">{{ past.accumulated }}</b> {{ m.accumulated }}</p>
            </div>
            <ul class="codes">
              <li v-for="c in past.courses" :key="c.code" :class="['chip', 'c', groupClass(c.colour)]" :title="c.name">{{ c.code }}</li>
            </ul>
          </section>

          <div class="rows" role="list" :aria-label="m.termsLabel">
            <section
              v-for="(row, r) in rows"
              :key="row.key"
              role="listitem"
              :class="['trow', row.tone, row.drop?.tone, { 'drop-target': dropRow === row.key || lifted?.target === r, stale: !fresh, now: row.now }]"
              :aria-labelledby="`term-${row.key}`"
              :data-test="`term-${row.key}`"
              @dragover="overRow($event, row.row.term)"
              @dragleave="leaveRow"
              @drop.prevent="dropOnRow(row.row.term)"
            >
              <div class="trow-l">
                <div class="tname">
                  <h3 :id="`term-${row.key}`">{{ row.name }}</h3>
                  <span v-if="row.summer" class="chip info">{{ m.summer }}</span>
                  <span v-if="row.now" class="chip info" data-test="now"><Icon name="lock" size="sm" />{{ m.inProgress }}</span>
                </div>
                <div v-if="row.load" class="tload" data-test="load">
                  <b>{{ row.load.text }}</b>
                  <span class="t3"> · {{ row.load.caps }}</span>
                  <span v-if="row.load.delta" :class="['delta', row.load.delta > 0 ? 'up' : 'down']" data-test="load-delta">{{ row.load.delta > 0 ? '+' : '−' }}{{ Math.abs(row.load.delta) }}</span>
                </div>
                <div v-if="row.meter" class="tmeter" aria-hidden="true">
                  <span class="track">
                    <i class="fill" :style="{ width: `${row.meter.fill}%` }" />
                    <i v-if="row.load?.delta" :class="['pre', { minus: row.load.delta < 0 }]" :style="{ left: `${row.meter.from}%`, width: `${row.meter.to - row.meter.from}%` }" />
                  </span>
                  <span v-if="row.meter.min !== null" class="tick" :style="{ left: `${row.meter.min}%` }"><em>{{ row.meter.minLabel }}</em></span>
                  <span class="tick max" :style="{ left: `${row.meter.max}%` }"><em>{{ row.meter.maxLabel }}</em></span>
                </div>
                <p v-if="row.drop?.reason" class="drop-reason" role="status" data-test="drop-reason">
                  <Icon :name="row.drop.tone === 'ok-drop' ? 'check' : row.drop.tone === 'checking' ? 'info' : 'alert'" size="sm" /><span>{{ row.drop.reason }}</span>
                </p>
              </div>
              <div class="trow-r">
                <ul v-if="row.issues.length" class="row-issues">
                  <li v-for="(issue, i) in row.issues" :key="i" :class="['ri', issue.kind]" :data-test="`row-issue-${issue.kind}`">
                    <Icon :name="KIND_STYLE[issue.kind].icon" size="sm" />
                    <span><span class="sr-only">{{ m.kinds[issue.kind] }}: </span>{{ m.issue[issue.code](issue, ctx) }} <span class="cite">{{ issue.citation }}</span></span>
                  </li>
                </ul>
                <ul class="tiles">
                  <template v-if="row.now">
                    <li v-for="c in inProgressNow" :key="`now-${c.code}`" :class="['ptile', 'locked', groupClass(c.colour)]" :data-test="`now-${c.code}`">
                      <div class="ptile-body">
                        <span class="top">
                          <span class="k">{{ c.code }}</span>
                          <span v-if="c.credits !== null" class="cr">{{ m.credits(c.credits) }}</span>
                        </span>
                        <span v-if="c.name" class="nm">{{ c.name }}</span>
                        <span class="sub"><Icon name="lock" size="sm" />{{ m.locked }}</span>
                      </div>
                    </li>
                  </template>
                  <li
                    v-for="t in row.tiles"
                    :id="`tile-${t.tile.key}`"
                    :key="t.tile.key"
                    :class="[t.classes, { lifted: lifted?.key === t.tile.key, 'dragging-src': dragging && 'key' in dragging && dragging.key === t.tile.key }]"
                    tabindex="0"
                    draggable="true"
                    :aria-label="t.label"
                    :aria-describedby="`tile-${t.tile.key}-body`"
                    aria-roledescription="draggable"
                    :data-flip="`tile-${t.tile.key}`"
                    :data-test="`tile-${t.tile.placement.courseCode ?? 'slot'}`"
                    @keydown="onTileKey($event, t.tile, r)"
                    @blur="onTileBlur(t.tile)"
                    @dragstart="startDrag($event, { key: t.tile.key })"
                    @dragend="endDrag"
                  >
                    <span v-if="t.bad" class="flag-badge" :title="m.hasViolation" aria-hidden="true">!</span>
                    <div :id="`tile-${t.tile.key}-body`" class="ptile-body">
                      <span class="top">
                        <span class="k">{{ t.title }}</span>
                        <span v-if="t.credits !== null" class="cr">{{ m.credits(t.credits) }}</span>
                      </span>
                      <span v-if="t.name" class="nm">{{ t.name }}</span>
                      <span v-else-if="t.slot" class="nm t3">{{ m.slotNotChosen }}</span>
                      <span v-if="t.group || t.taken" class="sub">
                        <span v-if="t.group" class="glabel" data-test="tile-group">{{ t.group }}</span>
                        <span v-if="t.taken" class="taken" data-test="tile-taken">{{ t.taken }}</span>
                      </span>
                      <ul v-if="t.issues.length || t.unknowns.length" class="tile-issues">
                        <li v-for="(issue, i) in t.issues" :key="i" :class="['ti', issue.kind]" :data-test="`tile-issue-${issue.kind}`">
                          <Icon :name="KIND_STYLE[issue.kind].icon" size="sm" />
                          <span><span class="sr-only">{{ m.kinds[issue.kind] }}: </span>{{ m.issue[issue.code](issue, ctx) }} <span class="cite">{{ issue.citation }}</span></span>
                        </li>
                        <li v-if="t.unknowns.length" class="ti unknown" data-test="tile-issue-unknown">
                          <Icon name="info" size="sm" /><span>{{ m.unknownWhat(t.unknowns) }}</span>
                        </li>
                      </ul>
                    </div>
                    <div class="ptile-acts">
                      <button class="btn sm ghost icon-only" type="button" :disabled="r === 0" :aria-label="m.moveEarlier(t.title)" :title="m.moveEarlier(t.title)" data-test="earlier" @click="moveBy(t.tile, -1)">
                        <Icon name="up" size="sm" />
                      </button>
                      <button class="btn sm ghost icon-only" type="button" :disabled="r === rows.length - 1" :aria-label="m.moveLater(t.title)" :title="m.moveLater(t.title)" data-test="later" @click="moveBy(t.tile, 1)">
                        <Icon name="down" size="sm" />
                      </button>
                      <button class="btn sm ghost icon-only" type="button" :aria-label="m.remove(t.title)" :title="m.remove(t.title)" data-test="remove" @click="remove(t.tile)">
                        <Icon name="x" size="sm" />
                      </button>
                    </div>
                  </li>
                  <li v-if="row.tiles.length === 0 && !row.now" class="drop-hint">{{ m.dropHere }}</li>
                </ul>
              </div>
            </section>
          </div>
          <button v-if="board.length" class="btn add-row" type="button" data-test="add-row" @click="addRow">
            <Icon name="plus" size="sm" />{{ m.addTerm(nameOf(nextTerm(board[board.length - 1]!.term))) }}
          </button>
        </div>

        <IssuesPanel
          :attached="issues"
          :status="issuesStatus"
          :fresh="fresh"
          :ctx="ctx"
          :collapsed="collapsed"
          :preview="panelPreview"
          @retry="retryCheck"
          @focus-tile="focusTile"
          @toggle="toggleRail"
        />
      </div>
    </template>

    <p class="sr-only" aria-live="polite" data-test="announcer">{{ announcement }}</p>
  </div>
</template>

<style>
.planner-page { max-width: 1480px; }
.planner-page .page-head { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; align-items: flex-start; }
.planner-page .head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.planner-page .kbd-hint { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.planner-layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; align-items: start; transition: grid-template-columns 0.2s; }
.planner-layout.rail-mini { grid-template-columns: minmax(0, 1fr) 56px; }
.planner-main { display: grid; gap: 14px; min-width: 0; }
.planner-layout .issues-panel { position: sticky; top: 16px; max-height: calc(100vh - 32px); overflow-y: auto; }
.tray { display: grid; gap: 10px; }
.tray.drop-ok { outline: 2px dashed var(--info); }
.tray-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tray-head h2 { font-size: 17px; }
.pool-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-left: auto; }
.pool-chips .chip { cursor: pointer; border: 1px solid transparent; font: inherit; font-size: 12.5px; }
.pool-chips .chip[aria-pressed='true'] { border-color: var(--ink-2); }
.tray-tools { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
.tray-tools .search { position: relative; flex: 1 1 240px; display: block; }
.tray-tools .search .icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--ink-3); }
.tray-tools .search .input { padding-left: 36px; }
.tray-tools .add-to { flex: 0 1 220px; }
.tray-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; max-height: 320px; overflow-y: auto; }
.pcourse {
  position: relative; display: grid; gap: 3px; padding: 9px 34px 9px 16px; border-radius: 12px; border: 1px solid var(--edge);
  background: var(--surface); box-shadow: var(--shadow-sm); cursor: grab; min-width: 0;
}
.pcourse::before { content: ''; position: absolute; left: 6px; top: 9px; bottom: 9px; width: 4px; border-radius: 4px; background: var(--c); }
.pcourse.slot { border-style: dashed; background: transparent; box-shadow: none; }
.pcourse .top, .ptile .top { display: flex; gap: 8px; align-items: center; justify-content: space-between; }
.pcourse .k, .ptile .k { font: 700 12px var(--mono); color: var(--c-ink, var(--ink)); }
.pcourse .nm { font-size: 13px; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
.pcourse .cr, .ptile .cr { font-size: 11.5px; font-weight: 650; padding: 1px 7px; border-radius: 999px; background: var(--c, var(--surface-3)); color: var(--on, var(--ink)); white-space: nowrap; }
.pcourse .sub, .ptile .sub { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; font-size: 11.5px; color: var(--ink-3); }
.pcourse .mark { display: inline-flex; align-items: center; gap: 4px; }
.pcourse .mark .icon, .ptile .sub .icon { width: 12px; height: 12px; }
.pcourse .add-btn { position: absolute; right: 4px; top: 4px; }
.slot-offers { display: grid; gap: 6px; }
.slot-offers h3 { text-transform: uppercase; letter-spacing: 0.04em; }
.rows { display: grid; gap: 10px; }
.trow {
  border: 1px solid var(--edge); border-radius: 14px; background: var(--surface); padding: 12px 14px;
  display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 10px 16px; transition: opacity 0.15s, border-color 0.15s;
}
.trow-l { display: grid; gap: 6px; align-content: start; min-width: 0; }
.trow-r { display: grid; gap: 8px; min-width: 0; align-content: start; }
.trow.past { background: var(--surface-2); }
.trow.past .codes { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 5px; align-content: start; }
.trow.past .codes .chip { font: 600 11.5px var(--mono); }
.trow.now { border-color: color-mix(in oklab, var(--info) 45%, var(--edge)); }
.trow.has-violation { border-color: color-mix(in oklab, var(--bad) 55%, var(--edge)); }
.trow.has-flag { border-color: color-mix(in oklab, var(--warn) 55%, var(--edge)); }
.trow.drop-target { outline: 2px dashed var(--info); outline-offset: 2px; }
.planner-main.dragging .trow.ok-drop { border-color: var(--ok); background: color-mix(in oklab, var(--ok) 6%, var(--surface)); }
.planner-main.dragging .trow.warn-drop { border-color: var(--warn); }
.planner-main.dragging .trow.bad-drop { border-color: var(--bad); background: color-mix(in oklab, var(--bad) 5%, var(--surface)); }
.planner-main.dragging .trow.bad-drop:not(.drop-target) { opacity: 0.5; }
.trow.stale .tload, .trow.stale .tmeter, .trow.stale .row-issues, .trow.stale .tile-issues { opacity: 0.55; }
.tname { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.tname h3 { font-size: 15px; }
.tload { font-size: 13px; font-variant-numeric: tabular-nums; }
.tload b { font-size: 18px; font-weight: 750; }
.tload .delta { margin-left: 6px; font-weight: 750; font-size: 13px; }
.tload .delta.up { color: color-mix(in oklab, var(--info) 80%, var(--ink)); }
.tload .delta.down { color: var(--ink-3); }
.tmeter { position: relative; height: 22px; }
.tmeter .track { position: relative; display: block; height: 8px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
.tmeter .fill { position: absolute; left: 0; top: 0; bottom: 0; background: var(--ok); transition: width 0.2s; }
.tmeter .pre { position: absolute; top: 0; bottom: 0; background: repeating-linear-gradient(45deg, var(--info), var(--info) 4px, color-mix(in oklab, var(--info) 55%, transparent) 4px, color-mix(in oklab, var(--info) 55%, transparent) 8px); }
.tmeter .pre.minus { background: var(--surface-3); outline: 1px dashed var(--ink-3); }
.trow.has-flag .tmeter .fill { background: var(--warn); }
.trow.has-violation .tmeter .fill { background: var(--bad); }
.tmeter .tick { position: absolute; top: -3px; height: 14px; width: 2px; background: var(--ink-3); border-radius: 2px; }
.tmeter .tick em { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); font: 600 10.5px var(--mono); font-style: normal; color: var(--ink-3); }
.drop-reason { display: flex; gap: 6px; align-items: flex-start; font-size: 12px; line-height: 1.35; margin: 0; }
.drop-reason .icon { flex: none; width: 13px; height: 13px; margin-top: 1px; }
.trow.ok-drop .drop-reason { color: color-mix(in oklab, var(--ok) 80%, var(--ink)); }
.trow.bad-drop .drop-reason { color: color-mix(in oklab, var(--bad) 82%, var(--ink)); font-weight: 600; }
.trow.warn-drop .drop-reason { color: color-mix(in oklab, var(--warn) 78%, var(--ink)); }
.trow.checking .drop-reason { color: var(--ink-3); }
.row-issues, .tile-issues { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.ri, .ti { display: flex; gap: 6px; align-items: flex-start; font-size: 12.5px; line-height: 1.35; }
.ri .icon, .ti .icon { flex: none; margin-top: 1px; width: 14px; height: 14px; }
.ri.violation, .ti.violation { color: color-mix(in oklab, var(--bad) 82%, var(--ink)); font-weight: 600; }
.ri.flag, .ti.flag { color: color-mix(in oklab, var(--warn) 78%, var(--ink)); }
.ri.unknown, .ti.unknown { color: var(--ink-3); font-style: italic; }
.ri .cite, .ti .cite { font: 500 11px var(--mono); color: var(--ink-3); }
.tiles { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
.ptile {
  position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; padding: 10px 6px 10px 16px; border-radius: 12px;
  border: 1px solid var(--edge); background: var(--surface); box-shadow: var(--shadow-sm); cursor: grab;
}
.ptile::before { content: ''; position: absolute; left: 6px; top: 10px; bottom: 10px; width: 4px; border-radius: 4px; background: var(--c, var(--edge-strong)); }
.ptile.slot { border-style: dashed; background: transparent; box-shadow: none; }
.ptile.locked { cursor: default; background: var(--surface-2); box-shadow: none; grid-template-columns: minmax(0, 1fr); }
.ptile.has-violation { border: 2px solid var(--bad); }
.ptile.has-flag { border: 2px dashed var(--warn); }
.ptile.lifted { outline: 3px solid var(--info); outline-offset: 2px; transform: translateY(-2px); box-shadow: var(--shadow-lg); }
.ptile.dragging-src { opacity: 0.4; }
.flag-badge {
  position: absolute; top: -8px; right: -8px; width: 20px; height: 20px; border-radius: 999px; display: grid; place-items: center;
  background: var(--bad); color: #fff; font: 800 12px var(--mono); box-shadow: var(--shadow-sm);
}
.ptile-body { display: grid; gap: 4px; min-width: 0; }
.ptile .nm { font-weight: 600; font-size: 13px; line-height: 1.3; overflow-wrap: anywhere; }
.ptile .taken { color: color-mix(in oklab, var(--warn) 75%, var(--ink)); }
.ptile-acts { display: flex; flex-direction: column; gap: 2px; opacity: 0; transition: opacity 0.12s; }
.ptile:hover .ptile-acts, .ptile:focus-within .ptile-acts, .ptile.lifted .ptile-acts { opacity: 1; }
.ptile-acts .btn.sm.icon-only { width: 28px; min-height: 26px; }
@media (hover: none) { .ptile-acts { opacity: 1; } }
.drop-hint { border: 1px dashed var(--edge-strong); border-radius: 12px; padding: 14px; text-align: center; color: var(--ink-3); font-size: 13px; }
.add-row { justify-self: start; }
.num { font-weight: 750; font-variant-numeric: tabular-nums; }
@media (max-width: 1100px) {
  .planner-layout, .planner-layout.rail-mini { grid-template-columns: minmax(0, 1fr); }
  .planner-layout .issues-panel { position: static; max-height: none; }
}
@media (max-width: 760px) {
  .trow { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 620px) {
  .tiles { grid-template-columns: 1fr; }
  .tray-tools .add-to { flex: 1 1 100%; }
  .planner-page .kbd-hint { white-space: normal; }
}
@media (prefers-reduced-motion: reduce) {
  .trow, .tmeter .fill, .ptile-acts, .planner-layout { transition: none; }
}
</style>
