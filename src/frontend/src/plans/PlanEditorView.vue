<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { statusOf } from '../api.js';
import { useAsyncLoad } from '../async-load.js';
import { useAuth } from '../auth/store.js';
import LoadState from '../components/LoadState.vue';
import SelectMenu from '../components/SelectMenu.vue';
import { groupClass, groupColour, groupOf, type GroupId } from '../groups.js';
import { formatNumber, localName, useLocale, useMessages } from '../locale.js';
import { COMMON_MESSAGES } from '../messages.js';
import { reducedMotion, replay, scrollToView } from '../motion.js';
import { useOnboarding } from '../onboarding/store.js';
import { usePageTitle } from '../page-title.js';
import Icon from '../shell/Icon.vue';
import { useToast } from '../shell/toast.js';
import { readStored, writeStored } from '../storage.js';
import { matchesEveryWord } from '../text-search.js';
import { compareTerms, nextTerm, termAt, termKey, termMonths, termName, type Term } from '../terms.js';
import { fetchPlan, type Plan, type PlanIssue, type PlanIssueCode, type PlanTermLoad } from './api.js';
import {
  addCourse,
  addSlot,
  boardOf,
  findTile,
  moveTile,
  placedCodes,
  removeTile,
  rowsFor,
  withNextRow,
  type Board,
  type Moving,
  type Row,
  type Tile,
} from './board.js';
import { pointerDrag, type DropTarget } from './drag.js';
import { play, snapshot, type Lift } from './flip.js';
import IssuesPanel from './IssuesPanel.vue';
import { rememberLastPlan } from './last-plan.js';
import { PLANNER_MESSAGES } from './messages.js';
import { usePlanActions } from './plan-actions.js';
import PlanTabs from './PlanTabs.vue';
import { KIND_STYLE, strongest } from './present.js';
import StatusStrip from './StatusStrip.vue';
import { useDropPreview } from './use-drop-preview.js';
import { usePlanContext } from './use-plan-context.js';
import { usePlanIssues } from './use-plan-issues.js';
import { usePlanSave, type Opened } from './use-plan-save.js';

// The plan editor (F5, UC-05): one row per term, the curriculum's courses to add, and moves by button, keyboard
// (Space, arrows, Enter, Escape: UC-05 A1) or drag and drop. Each change saves the whole board (ADR 0014,
// use-plan-save.ts), then the rule engine's report is read again from GET /plans/{id}/issues (use-plan-issues.ts).
// While a course is dragged or lifted, the editor asks the engine about the board with the drop made
// (POST /plans/{id}/issues/drops, which saves nothing: use-drop-preview.ts), so each row can say before the drop
// whether it would break a rule and what its load would be. The editor never judges a placement, a load or a
// requirement itself (AGENTS.md hard rule 1): colours, loads, caps and reasons come only from those reports. This
// file wires them to the board on screen: what each row and tile shows, and the moves by pointer and keyboard.
const props = defineProps<{ id: string }>();
const auth = useAuth();
const onboarding = useOnboarding();
const locale = useLocale();
const toast = useToast();
const router = useRouter();
const m = useMessages(PLANNER_MESSAGES);
const common = useMessages(COMMON_MESSAGES);

const plan = shallowRef<Plan | null>(null);
/** The board on screen. */
const board = shallowRef<Board>([]);
/** The board the API last saved. */
const saved = shallowRef<Board>([]);
/** The tile lifted with the keyboard, and the row it would drop on. */
const lifted = shallowRef<{ key: number; target: number } | null>(null);
let nextKey = 0;
const newKey = () => nextKey++;
const currentTermNow = () => termAt(new Date());

let opened: Opened = { id: props.id, saving: false };

const { issues, status: issuesStatus, check, dropPending, reset: resetIssues, fresh, ctx } = usePlanIssues(board, () => opened.id);
/** The Issues panel's retry. During a save it waits: the loop checks when it ends, after the last PUT. */
function retryCheck(): void {
  if (!opened.saving) void check(saved.value);
}

const { saveState, saveError, save, history, record, takeLast, locked, setLock, open: openLock, reset: resetSave } = usePlanSave({
  plan,
  board,
  saved,
  opened: () => opened,
  issues: { check, dropPending },
  revert() {
    animate(() => (board.value = saved.value));
    // A lifted tile's target row may be gone, or the tile may be back in another row.
    lifted.value = null;
  },
  words: () => m.value,
});

const { moving, previews, homeOf, isHome, previewRow, previewAll, stopPreview } = useDropPreview(board, issues, () => opened.id);

// ---------- Changes, their animation and undo ----------
const boardEl = ref<HTMLElement | null>(null);
/** Runs a change of the board, then lets each tile glide from where it was (flip.ts); a dropped one lands from the ghost. */
function animate(fn: () => void, lift?: Lift): void {
  const before = snapshot(boardEl.value);
  fn();
  void nextTick(() => play(boardEl.value, before, lift));
}

function change(next: Board, said?: string, undoing = false, lift?: Lift): void {
  if (next === board.value || locked.value) return;
  if (!undoing) record(board.value, said ?? '');
  animate(() => (board.value = next), lift);
  saveError.value = null;
  if (said) announce(said);
  void save();
}

function undo(): void {
  const last = takeLast();
  if (!last) {
    toast.show(m.value.nothingToUndo);
    return;
  }
  lifted.value = null;
  const said = m.value.undone(last.said);
  change(last.board, said, true);
  toast.show(said);
}

function onWindowKey(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z' || event.shiftKey || locked.value) return;
  const target = event.target as HTMLElement | null;
  // A text box or an editable element keeps its own undo.
  if (target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
  event.preventDefault();
  undo();
}

function toggleLock(): void {
  if (!plan.value) return;
  setLock(plan.value.id, !locked.value);
  if (locked.value) {
    drag.stop();
    endDrag();
    dropLifted();
  }
  announce(locked.value ? m.value.lockedNote : m.value.unlock);
}

// ---------- Loading ----------
const loaded = useAsyncLoad(
  'the plan',
  async () => {
    const mine: Opened = (opened = { id: props.id, saving: false });
    resetIssues();
    resetSave();
    lifted.value = null;
    const found = await auth.authed((token) => fetchPlan(token, mine.id));
    // The rows run to the target graduation term; without onboarding answers they stop at the plan's last term.
    const target = await onboarding.load().then(
      (answers) => answers.targetGraduationTerm,
      () => null,
    );
    // A later load owns the editor now; useAsyncLoad drops this answer too.
    if (mine !== opened) return found;
    drag.stop();
    endDrag();
    lifted.value = null;
    const start = boardOf(found.terms, rowsFor(found.terms, currentTermNow(), target), newKey);
    plan.value = found;
    openLock(found.id);
    rememberLastPlan(found.id);
    board.value = start;
    saved.value = start;
    addTarget.value = termKey(start.find((row) => compareTerms(row.term, currentTermNow()) >= 0)?.term ?? start[0]!.term);
    void check(start);
    return found;
  },
  () => props.id,
);

// ---------- What a tile shows ----------
const { curriculum, requirementGroups, catalog, groupNames, transcriptCodes, audit, passed, passedCodes, gradeOf, pastTerms, inProgressNow } = usePlanContext(
  plan,
  currentTermNow,
);
const shortName = (colour: GroupId) => groupOf(colour).short[locale.lang];
const glyphOf = (colour: GroupId) => groupOf(colour).glyph;
/** The terms before the current one, with what the engine counts as passed, for the "Taken" strip. */
const past = computed(() => {
  const terms = pastTerms.value;
  if (!audit.value || terms.length === 0) return null;
  return {
    span: m.value.pastTerms(terms.length, nameOf(terms[0]!.term), nameOf(terms.at(-1)!.term)),
    accumulated: audit.value.credits.accumulated,
    courses: passed.value.map((c) => ({ code: c.code, name: localName(c, locale.lang), colour: catalog.value.get(c.code)?.colour ?? 'core' })),
  };
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

// ---------- The drag preview on screen ----------
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
  if (!what || !row || isHome(what, row.term)) return null;
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
  colour: GroupId | null;
  /** The tile's issues in words, for its tooltip. */
  tip: string;
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

function capOf(issues: readonly PlanIssue[], credits: number): RowView['cap'] {
  if (issues.some((i) => i.code === 'load_above_maximum')) return 'over';
  if (issues.some((i) => i.code === 'load_below_minimum')) return 'under';
  return credits > 0 ? 'ok' : '';
}

/** Issues the credit bar already shows (over or under the caps): the row gives them no words of its own. */
const BAR_CODES: ReadonlySet<PlanIssue['code']> = new Set(['load_above_maximum', 'load_below_minimum']);

const toneOf = (issues: readonly PlanIssue[]) => {
  const kind = strongest(issues.filter((i) => i.kind !== 'unknown'));
  return kind ? `has-${kind}` : '';
};
const gradeText = (n: number) => formatNumber(n, locale.lang, 1);

function tileView(tile: Tile, termName: string): TileView {
  const p = tile.placement;
  const info = p.courseCode ? catalog.value.get(p.courseCode) : undefined;
  const slotGroup = p.kind === 'slot' ? groupNames.value.get(p.requirementGroupId ?? '') : undefined;
  const colour = info?.colour ?? (slotGroup ? groupColour(slotGroup) : null);
  const all = issues.value?.byTile.get(tile.key) ?? [];
  const title = tileTitle(tile);
  const grade = p.courseCode ? gradeOf.value.get(p.courseCode) : undefined;
  const tone = toneOf(all);
  const shown = [...all.filter((i) => i.kind === 'violation'), ...all.filter((i) => i.kind === 'flag')];
  const unknowns = all.filter((i) => i.kind === 'unknown').map((i) => i.code);
  const tip = [...shown.map((i) => `${m.value.kinds[i.kind]}: ${m.value.issue[i.code](i, ctx.value)}`), ...(unknowns.length ? [m.value.unknownWhat(unknowns)] : [])].join('\n');
  return {
    tile,
    title,
    label: m.value.tileLabel(title, termName),
    credits: p.kind === 'slot' ? (p.credits ?? null) : (info?.course.credits ?? null),
    name: info ? localName(info.course, locale.lang) : null,
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
  // No colour would read as "no problem": say the preview is missing. Pointing at the row asks again.
  if (p.status === 'failed') return { tone: 'failed-drop', reason: m.value.dropFailed };
  if (!p.verdict) return null;
  const v = p.verdict;
  // A load against the caps is shown by the bar alone; only another rule gets words.
  const first = v.issues.find((i) => !BAR_CODES.has(i.code));
  if (!v.kind) return { tone: 'ok-drop', reason: '' };
  const tone = v.kind === 'violation' ? 'bad-drop' : v.kind === 'flag' ? 'warn-drop' : 'unknown-drop';
  if (!first) return { tone, reason: '' };
  const text = m.value.issue[first.code](first, ctx.value);
  return { tone, reason: first.kind === 'unknown' ? m.value.dropUnknown(text) : text };
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
    when: m.value.termMonths(termMonths(row.term)),
    load: load && {
      atLeast,
      caps: load.caps ? m.value.caps(load.caps.min, load.caps.max) : m.value.capsUnknown,
      credits: load.credits,
      max: load.caps?.max ?? null,
      delta: previewed ? load.credits - baseCredits : 0,
    },
    meter: meter(load, baseCredits),
    cap: capOf(previewed ? (hoverPreview.value?.attached?.byTerm.get(key) ?? []) : rowIssues, load?.credits ?? 0),
    tone: toneOf(rowIssues),
    drop: dropOf(key),
    placeholder: dropRow.value === key && movingInfo.value && !(moving.value && isHome(moving.value, row.term)) ? movingInfo.value : null,
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

/**
 * Takes a tile out of the plan. From its button or the Delete key, focus goes to the tile beside it in the same term
 * (or the course search when the term is now empty) without scrolling, so the page stays where the student was; a
 * drop on the tray or the bin leaves the focus alone.
 */
function remove(tile: Tile, moveFocus = true): void {
  const found = findTile(board.value, tile.key);
  const beside = found ? (found.row.tiles[found.index + 1] ?? found.row.tiles[found.index - 1]) : undefined;
  change(removeTile(board.value, tile.key), m.value.removed(tileTitle(tile)));
  if (!moveFocus) return;
  void nextTick(() => (document.getElementById(beside ? `tile-${beside.key}` : 'course-search') as HTMLElement | null)?.focus({ preventScroll: true }));
}

const query = ref('');
const poolGroup = ref<GroupId | ''>('');
const addTarget = ref('');
const addTargetTerm = computed(() => board.value.find((row) => termKey(row.term) === addTarget.value)?.term ?? board.value[0]?.term ?? null);
/** The tray: courses not placed and not in progress now. A passed course stays, marked as passed. */
const unplaced = computed(() => {
  const placed = placedCodes(board.value);
  const now = new Set(inProgressNow.value.map((c) => c.code));
  return [...catalog.value.values()].filter(({ course }) => !placed.has(course.code) && !now.has(course.code));
});
const poolGroups = computed(() => [...new Set(unplaced.value.map((c) => c.colour))]);
const shown = computed(() =>
  unplaced.value.filter(({ course, colour }) => (!poolGroup.value || colour === poolGroup.value) && matchesEveryWord(query.value, course.code, course.nameVi, course.nameEn)),
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

/** Adds a course to a term; `from` is where its dragged copy was, so the tile lands from there. Returns its key. */
function add(code: string, to: Term | null = addTargetTerm.value, from?: DOMRect): number | null {
  if (!to) return null;
  const key = newKey();
  change(addCourse(board.value, code, to, key), m.value.added(code, nameOf(to)), false, from && { flip: `tile-${key}`, rect: from });
  return key;
}
function addSlotTo(groupId: string, credits: number, to: Term | null = addTargetTerm.value, from?: DOMRect): number | null {
  if (!to) return null;
  const key = newKey();
  const said = m.value.added(m.value.slot(groupNames.value.get(groupId)?.name ?? m.value.slotGroupUnknown), nameOf(to));
  change(addSlot(board.value, groupId, credits, to, key), said, false, from && { flip: `tile-${key}`, rect: from });
  return key;
}

/**
 * An empty row is not stored (ADR 0014): adding one saves nothing, and a report of the board still describes it.
 * The page then scrolls by the new row's height, so the button stays under the pointer for the next click.
 */
async function addRow(event?: MouseEvent): Promise<void> {
  if (locked.value) return;
  const button = event?.currentTarget as HTMLElement | undefined;
  const top = button?.getBoundingClientRect().top;
  const before = board.value;
  const next = withNextRow(before);
  board.value = next;
  if (saved.value === before) saved.value = next;
  await nextTick();
  if (!button || top === undefined) return;
  const by = button.getBoundingClientRect().top - top;
  if (by > 0) window.scrollBy({ top: by, behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/** Brings a tile into view and makes it shake and glow for a moment, so the eye finds it. */
async function jumpTo(key: number): Promise<void> {
  await nextTick();
  const el = document.getElementById(`tile-${key}`);
  if (!el) return;
  scrollToView(el, 'center');
  el.focus({ preventScroll: true });
  replay(el, 'flash');
}

/** A passed course in the "Taken" strip: its place in the curriculum explorer. */
function showInExplorer(code: string): void {
  void router.push({ name: 'explorer', query: { course: code } });
}

/** Brings a row into view as the keyboard picks it, as dragging near the edge does for the pointer. */
async function revealRow(index: number): Promise<void> {
  await nextTick();
  const el = boardEl.value?.querySelectorAll<HTMLElement>('.trow')[index];
  if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// Keyboard moves (UC-05 A1): Space lifts the focused tile, the arrows pick a row, Enter or Space drops, Escape cancels.
function onTileKey(event: KeyboardEvent, tile: Tile, rowIndex: number): void {
  if (event.target !== event.currentTarget || locked.value) return;
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
    previewAll(moving.value);
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

// Drag and drop with the pointer (drag.ts, as in the prototype): a tile, a course or a slot of the tray onto a row,
// or a placed tile onto the tray or the bin to take it out of the plan. The ghost leans as it moves, the wheel scrolls
// the page meanwhile, and near the top or bottom of the window the page scrolls by itself.
const dragging = shallowRef<Moving | null>(null);
const over = ref<DropTarget | null>(null);
const dropRow = computed(() => (over.value?.startsWith('row:') ? over.value.slice(4) : null));
const draggingPlaced = computed(() => !!dragging.value && 'key' in dragging.value);
// Only the target row's verdict is read out, once it is known: every row showing one at a time would be a chorus.
watch(
  () => (hoverKey.value ? (dropOf(hoverKey.value)?.reason ?? '') : ''),
  (reason) => {
    if (reason && reason !== m.value.dropChecking) announce(reason);
  },
);
// A row whose preview failed (the network, a busy server) asks again when the pointer comes over it.
watch(
  () => (dragging.value ? over.value : null),
  (target) => {
    const what = moving.value;
    const row = target?.startsWith('row:') ? board.value.find((r) => `row:${termKey(r.term)}` === target) : undefined;
    if (what && row) previewRow(what, row.term);
  },
);

/** How long a dropped tile takes to land (flip.ts) before a refused drop shakes it. */
const LANDING_MS = 420;

const drag = pointerDrag<Moving>({
  begin(what) {
    dragging.value = what;
    moving.value = what;
    lifted.value = null;
    previewAll(what);
  },
  over(target) {
    over.value = target;
  },
  accepts(what, target) {
    if (target === 'pool' || target === 'bin') return 'key' in what;
    const home = homeOf(what);
    return !home || `row:${termKey(home)}` !== target;
  },
  drop(what, target, from) {
    const verdict = target.startsWith('row:') ? (previews.value.get(target.slice(4))?.verdict ?? null) : null;
    endDrag();
    const key = dropOn(what, target, from);
    // A drop that breaks a rule still lands (ADR 0012); the tile shakes once it has landed, so the student sees it.
    if (key !== null && verdict?.kind === 'violation') {
      void nextTick(() => {
        const el = document.getElementById(`tile-${key}`);
        if (el) setTimeout(() => replay(el, 'shake'), LANDING_MS);
      });
    }
  },
  cancel() {
    endDrag();
  },
});
function grab(event: PointerEvent, what: Moving): void {
  if (locked.value) return;
  drag.down(event, event.currentTarget as HTMLElement, what);
}
function endDrag(): void {
  dragging.value = null;
  over.value = null;
  if (!lifted.value) {
    moving.value = null;
    stopPreview();
  }
}
/** Applies a drop; returns the key of the tile it placed or moved, if any. */
function dropOn(what: Moving, target: DropTarget, from: DOMRect): number | null {
  if (target === 'pool' || target === 'bin') {
    const found = 'key' in what ? findTile(board.value, what.key) : undefined;
    if (found) remove(found.row.tiles[found.index]!, false);
    return null;
  }
  const term = board.value.find((row) => `row:${termKey(row.term)}` === target)?.term;
  if (!term) return null;
  if ('code' in what) return add(what.code, term, from);
  if ('slot' in what) return addSlotTo(what.slot, what.credits, term, from);
  const found = findTile(board.value, what.key);
  if (!found) return null;
  change(moveTile(board.value, what.key, term), m.value.moved(tileTitle(found.row.tiles[found.index]!), nameOf(term)), false, { flip: `tile-${what.key}`, rect: from });
  return what.key;
}

/** What the placeholder in the row under the pointer shows: the course, its credits and its group colour. */
const movingInfo = computed<{ title: string; credits: number | null; colour: GroupId | null } | null>(() => {
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

// ---------- The issues panel, open or collapsed (kept for the next visit on this browser) ----------
const RAIL_KEY = 'oc-planner-rail';
const collapsed = ref(readStored(RAIL_KEY) === 'mini');
function toggleRail(): void {
  collapsed.value = !collapsed.value;
  writeStored(RAIL_KEY, collapsed.value ? 'mini' : 'open');
}

// ---------- What-if: try a change on a copy, opened at once ----------
// The tabs get these actions too, so their buttons wait while a copy is made.
const actions = usePlanActions();
function whatIf(): void {
  const current = plan.value;
  if (!current) return;
  void actions.copy(current.id, m.value.whatIfName(current.name), async (made) => {
    toast.show(m.value.copied(made.name));
    await router.push({ name: 'plan', params: { id: made.id } });
  });
}

onMounted(() => window.addEventListener('keydown', onWindowKey));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKey);
  drag.stop();
  stopPreview();
});

usePageTitle(() => plan.value?.name ?? m.value.title);
</script>



<template>
  <div class="page planner-page">
    <header class="page-head">
      <div>
        <RouterLink class="back-link" :to="{ name: 'plan-list' }" data-test="back-to-list"><Icon name="left" size="sm" />{{ m.backToList }}</RouterLink>
        <h1>{{ plan?.name ?? m.title }}</h1>
        <p>{{ m.editorLead }}</p>
        <p class="sr-only" data-test="keyboard-hint">{{ m.keyboardHint }}</p>
      </div>
      <div v-if="plan" class="head-actions">
        <button
          :class="['btn', { 'lock-on': locked }]"
          type="button"
          :aria-pressed="locked"
          :title="m.lockHint"
          data-test="lock"
          @click="toggleLock"
        >
          <Icon :name="locked ? 'lock' : 'unlock'" size="sm" />{{ locked ? m.unlock : m.lock }}
        </button>
        <button class="btn" type="button" :disabled="history.length === 0 || locked" :title="`${m.undo} (Ctrl+Z)`" data-test="undo" @click="undo"><Icon name="undo" size="sm" />{{ m.undo }}</button>
        <button class="btn" type="button" :title="m.whatIfHint" data-test="what-if" @click="whatIf"><Icon name="fork" size="sm" />{{ m.whatIf }}</button>
      </div>
    </header>

    <LoadState v-if="loaded.status.value !== 'loaded'" :status="loaded.status.value" :loading="common.loading" :failed="m.loadFailed" @retry="loaded.reload">
      <div v-if="statusOf(loaded.error.value) === 404">
        <p>{{ m.notFound }}</p>
        <RouterLink class="btn sm" :to="{ name: 'plan-list' }">{{ m.allPlans }}</RouterLink>
      </div>
    </LoadState>

    <template v-else-if="plan">
      <PlanTabs :id="plan.id" :name="plan.name" :curriculum="plan.curriculum" :actions="actions" />
      <p v-if="locked" class="callout info small lock-note" role="status" data-test="locked-note"><Icon name="lock" size="sm" /><span>{{ m.lockedNote }}</span></p>
      <StatusStrip :attached="issues" :fresh="fresh" :save-state="saveState" />
      <p class="small t3">{{ m.curriculum(plan.curriculum.code) }}</p>
      <p v-if="saveError" class="callout bad" role="alert" data-test="save-error"><Icon name="alert" /><span>{{ saveError }}</span></p>

      <div class="planner-layout" :class="{ 'rail-mini': collapsed }">
        <div ref="boardEl" class="planner-main" :class="{ dragging: !!moving, 'is-locked': locked }">
          <section
            class="card tray"
            :class="{ 'ok-drop': draggingPlaced, over: draggingPlaced && over === 'pool' }"
            aria-labelledby="tray-title"
            :data-drop="draggingPlaced ? 'pool' : undefined"
            data-test="tray"
          >
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
                  <span class="glyph xs" aria-hidden="true">{{ glyphOf(g) }}</span>{{ shortName(g) }}
                </button>
              </div>
              <p v-if="draggingPlaced" class="drop-reason tray-reason"><Icon name="trash" size="sm" /><span>{{ m.dropToRemove }}</span></p>
            </div>
            <div class="tray-tools">
              <label class="search">
                <span class="sr-only">{{ m.search }}</span>
                <Icon name="search" size="sm" />
                <input id="course-search" v-model="query" class="input" type="search" :placeholder="m.searchPlaceholder" />
              </label>
              <label class="field add-to">
                <span>{{ m.addTo }}</span>
                <SelectMenu v-model="addTarget" :options="board.map((row) => ({ value: termKey(row.term), label: nameOf(row.term) }))" data-test="add-to" />
              </label>
            </div>
            <LoadState
              v-if="curriculum.status.value !== 'loaded'"
              :status="curriculum.status.value"
              :loading="common.loading"
              :failed="statusOf(curriculum.error.value) === 404 ? m.noCurriculum : m.curriculumFailed"
              tone="warn"
              small
              @retry="curriculum.reload"
            />
            <p v-else-if="unplaced.length === 0" class="small t2" role="status">{{ m.allPlaced }}</p>
            <p v-else-if="shown.length === 0" class="small t2" role="status">{{ m.noMatch }}</p>
            <ul v-else class="tray-list">
              <li
                v-for="{ course, colour } in shown"
                :key="course.code"
                :class="['pcourse', groupClass(colour), { 'dragging-src': dragging && 'code' in dragging && dragging.code === course.code }]"
                :data-flip="`pool-${course.code}`"
                :data-test="`pool-${course.code}`"
                aria-roledescription="draggable"
                @pointerdown="grab($event, { code: course.code })"
              >
                <span class="top">
                  <span class="k">{{ course.code }}</span>
                  <span class="cr">{{ m.credits(course.credits) }}</span>
                </span>
                <span class="nm" :title="localName(course, locale.lang)">{{ localName(course, locale.lang) }}</span>
                <span class="sub">
                  <span class="glabel">{{ shortName(colour) }}</span>
                  <span v-if="passedCodes.has(course.code)" class="mark passed" data-test="passed"><Icon name="check" size="sm" />{{ m.passedMark }}</span>
                  <span v-else-if="transcriptCodes.has(course.code)" class="mark" data-test="in-transcript"><Icon name="file" size="sm" />{{ m.inTranscript }}</span>
                </span>
                <button
                  class="add-btn"
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
                  aria-roledescription="draggable"
                  data-test="slot-offer"
                  @pointerdown="grab($event, { slot: s.group.id, credits: s.credits })"
                >
                  <span class="top">
                    <span class="k">{{ shortName(s.colour) }}</span>
                    <span class="cr">{{ m.credits(s.credits) }}</span>
                  </span>
                  <span class="nm">{{ s.group.name }}</span>
                  <span class="sub"><span class="glabel">{{ m.slotNotChosen }}</span></span>
                  <button
                    class="add-btn"
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
              <li v-for="c in past.courses" :key="c.code">
                <button :class="['code', 'c', groupClass(c.colour)]" type="button" :title="`${c.name}\n${m.showInExplorer(c.code)}`" :data-test="`past-${c.code}`" @click="showInExplorer(c.code)">{{ c.code }}</button>
              </li>
            </ul>
          </section>

          <TransitionGroup name="row" tag="div" class="rows" role="list" :aria-label="m.termsLabel" data-drop-gap>
            <section
              v-for="(row, r) in rows"
              :key="row.key"
              role="listitem"
              :class="['trow', row.tone, row.drop?.tone, { over: dropRow === row.key || lifted?.target === r, 'drop-target': lifted?.target === r, stale: !fresh, now: row.now }]"
              :aria-labelledby="`term-${row.key}`"
              :data-drop="`row:${row.key}`"
              :data-test="`term-${row.key}`"
            >
              <div class="trow-l">
                <div class="tname">
                  <h3 :id="`term-${row.key}`">{{ row.name }}</h3>
                  <span v-if="row.summer" class="chip info">{{ m.summer }}</span>
                  <span v-if="row.now" class="chip info" data-test="now"><Icon name="lock" size="sm" />{{ m.inProgress }}</span>
                  <small class="when" data-test="when">{{ row.when }}</small>
                </div>
                <div v-if="row.load" class="tload" :class="{ up: row.load.delta > 0, down: row.load.delta < 0 }" :title="row.load.caps" data-test="load">
                  <template v-if="row.load.atLeast">{{ `${m.atLeast} ` }}</template><b :key="row.load.credits" class="pop">{{ row.load.credits }}</b>{{ m.ofCap(row.load.max) }}<span class="sr-only">{{ ` · ${row.load.caps}` }}</span>
                  <span v-if="row.load.delta" :class="['delta', row.load.delta > 0 ? 'up' : 'down']" data-test="load-delta">{{ row.load.delta > 0 ? '+' : '−' }}{{ Math.abs(row.load.delta) }}</span>
                </div>
                <div v-if="row.meter" :class="['cap', row.cap, { preview: !!row.load?.delta }]" aria-hidden="true">
                  <span class="track">
                    <i class="fill" :style="{ width: `${row.meter.fill}%` }" />
                    <i :class="['pre', { minus: (row.load?.delta ?? 0) < 0 }]" :style="{ left: `${row.meter.from}%`, width: `${row.meter.to - row.meter.from}%` }" />
                  </span>
                  <span v-if="row.meter.min !== null" class="tick" :style="{ left: `${row.meter.min}%` }"><em>{{ row.meter.minLabel }}</em></span>
                  <span class="tick max" :style="{ left: `${row.meter.max}%` }"><em>{{ row.meter.maxLabel }}</em></span>
                </div>
                <p v-if="row.drop?.reason" class="drop-reason" data-test="drop-reason">
                  <Icon :name="row.drop.tone === 'ok-drop' ? 'check' : row.drop.tone === 'checking' || row.drop.tone === 'failed-drop' ? 'refresh' : row.drop.tone === 'unknown-drop' ? 'info' : 'alert'" size="sm" /><span>{{ row.drop.reason }}</span>
                </p>
                <ul v-if="row.issues.length" class="row-issues">
                  <li
                    v-for="(issue, i) in row.issues"
                    :key="i"
                    :class="['ri', issue.kind, { 'sr-only': BAR_CODES.has(issue.code) }]"
                    :title="`${m.issue[issue.code](issue, ctx)}\n${issue.citation}`"
                    :data-test="`row-issue-${issue.kind}`"
                  >
                    <Icon :name="KIND_STYLE[issue.kind].icon" size="sm" />
                    <span aria-hidden="true">{{ m.issueTitle[issue.code] }}</span>
                    <span class="sr-only">{{ m.kinds[issue.kind] }}: {{ m.issue[issue.code](issue, ctx) }} {{ issue.citation }}</span>
                  </li>
                </ul>
              </div>
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
                  :title="t.tip || undefined"
                  :aria-label="t.label"
                  :aria-describedby="`tile-${t.tile.key}-body`"
                  aria-roledescription="draggable"
                  :data-flip="`tile-${t.tile.key}`"
                  :data-test="`tile-${t.tile.placement.courseCode ?? 'slot'}`"
                  @keydown="onTileKey($event, t.tile, r)"
                  @blur="onTileBlur(t.tile)"
                  @pointerdown="grab($event, { key: t.tile.key })"
                >
                  <span v-if="t.bad" class="flag-badge" aria-hidden="true">!</span>
                  <div :id="`tile-${t.tile.key}-body`" class="ptile-body">
                    <span class="top">
                      <span class="k">{{ t.title }}</span>
                      <span v-if="t.credits !== null" class="cr">{{ m.credits(t.credits) }}</span>
                    </span>
                    <span v-if="t.name" class="nm">{{ t.name }}</span>
                    <span v-else-if="t.slot" class="nm t3">{{ m.slotNotChosen }}</span>
                    <span v-if="t.group || t.taken" class="sub">
                      <span v-if="t.taken" class="rt" data-test="tile-taken"><Icon name="refresh" size="sm" />{{ t.taken }}</span>
                      <span v-if="t.group" class="glabel" data-test="tile-group">{{ t.group }}</span>
                    </span>
                    <ul v-if="t.issues.length || t.unknowns.length" class="sr-only">
                      <li v-for="(issue, i) in t.issues" :key="i" :data-test="`tile-issue-${issue.kind}`">
                        {{ m.kinds[issue.kind] }}: {{ m.issue[issue.code](issue, ctx) }} {{ issue.citation }}
                      </li>
                      <li v-if="t.unknowns.length" data-test="tile-issue-unknown">{{ m.unknownWhat(t.unknowns) }}</li>
                    </ul>
                  </div>
                  <div class="ptile-acts">
                    <button type="button" :disabled="r === 0" :aria-label="m.moveEarlier(t.title)" :title="m.moveEarlier(t.title)" data-test="earlier" @click="moveBy(t.tile, -1)">
                      <Icon name="up" size="sm" />
                    </button>
                    <button type="button" :disabled="r === rows.length - 1" :aria-label="m.moveLater(t.title)" :title="m.moveLater(t.title)" data-test="later" @click="moveBy(t.tile, 1)">
                      <Icon name="down" size="sm" />
                    </button>
                    <button type="button" class="rm" :aria-label="m.remove(t.title)" :title="m.remove(t.title)" data-test="remove" @click="remove(t.tile)">
                      <Icon name="x" size="sm" />
                    </button>
                  </div>
                </li>
                <li v-if="row.placeholder" :class="['tile-ph', row.placeholder.colour ? groupClass(row.placeholder.colour) : 'g-none']" aria-hidden="true" data-test="placeholder">
                  <span class="k">{{ row.placeholder.title }}</span>
                  <span v-if="row.placeholder.credits !== null" class="cr">+{{ m.credits(row.placeholder.credits) }}</span>
                </li>
                <li v-else-if="row.tiles.length === 0 && !row.now" class="drop-hint">{{ m.dropHere }}</li>
              </ul>
            </section>
          </TransitionGroup>
          <button v-if="board.length" class="add-row" type="button" data-test="add-row" @click="addRow">
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
          @focus-tile="jumpTo"
          @toggle="toggleRail"
        />
      </div>
    </template>

    <Transition name="bin">
      <div v-if="draggingPlaced" class="drop-bin" :class="{ over: over === 'bin' }" data-drop="bin" data-test="drop-bin">
        <span class="ic" aria-hidden="true"><Icon name="trash" /></span>
        <span><b>{{ m.binLabel }}</b><small>{{ m.binHint }}</small></span>
      </div>
    </Transition>

    <p class="sr-only" aria-live="polite" data-test="announcer">{{ announcement }}</p>
  </div>
</template>

<style>
.planner-page { max-width: 1480px; }
.back-link { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 6px; font-weight: 650; font-size: 14px; color: var(--ink-2); text-decoration: none; }
.back-link:hover { color: var(--ink); }
.btn.lock-on { background: color-mix(in oklab, var(--info) 12%, var(--surface)); border-color: color-mix(in oklab, var(--info) 45%, var(--edge)); color: color-mix(in oklab, var(--info) 80%, var(--ink)); }
.lock-note { display: flex; align-items: center; gap: 8px; }
/* Locked: nothing to grab, add or remove. */
.planner-main.is-locked .pcourse, .planner-main.is-locked .ptile { cursor: default; }
.planner-main.is-locked .pcourse:hover, .planner-main.is-locked .ptile:hover { transform: none; box-shadow: none; }
.planner-main.is-locked .ptile-acts, .planner-main.is-locked .add-btn, .planner-main.is-locked .add-row { display: none; }
.planner-page .page-head > div:first-child { min-width: 0; flex: 1 1 320px; }
.planner-page .page-head h1 { overflow-wrap: anywhere; }
.planner-page .page-head { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; align-items: flex-start; }
.planner-page .head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.planner-page .kbd-hint { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.planner-layout { --rail: 340px; display: grid; grid-template-columns: minmax(0, 1fr) var(--rail); gap: 18px; align-items: start; transition: grid-template-columns 0.32s cubic-bezier(0.2, 0.8, 0.2, 1); }
.planner-layout.rail-mini { --rail: 60px; }
.planner-main { display: grid; gap: 14px; min-width: 0; }
.planner-layout .issues-panel { position: sticky; top: 20px; max-height: calc(100vh - 40px); }

/* The course list (the prototype's "Kho môn") */
.tray { position: relative; padding: 14px 16px 16px; display: grid; gap: 12px; transition: background 0.2s, box-shadow 0.2s, border-color 0.2s; }
.tray-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tray-head h2 { font-size: 17px; }
.pool-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-left: auto; }
.pool-chips .chip { cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 650; padding-left: 4px; transition: background 0.15s, color 0.15s, box-shadow 0.15s; }
.pool-chips .chip:not(.soft) { padding-left: 10px; }
.pool-chips .chip[aria-pressed='true'] { background: var(--acc-bg); color: var(--acc-ink); }
.pool-chips .chip.soft[aria-pressed='true'] { background: var(--c); color: var(--on); }
.pool-chips .chip.soft[aria-pressed='true'] .glyph { background: color-mix(in oklab, var(--on) 22%, transparent); color: var(--on); }
.tray-tools { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
.tray-tools .search { position: relative; flex: 1 1 240px; display: block; }
.tray-tools .search .icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--ink-3); }
.tray-tools .search .input { padding-left: 36px; }
.tray-tools .add-to { flex: 0 1 220px; }
.tray-list { list-style: none; margin: 0; padding: 4px 4px 4px 2px; display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; max-height: 330px; overflow-y: auto; }
.tray .tray-reason { position: absolute; z-index: 2; top: 10px; right: 12px; max-width: calc(100% - 24px); box-shadow: var(--shadow-sm); }
.tray.over .tray-reason { display: flex; }
.slot-offers { display: grid; gap: 6px; }
.slot-offers h3 { font-weight: 650; }

/* Course tiles, as in the prototype: white with a bar in the group colour, a pill for the credits */
.pcourse, .ptile {
  position: relative; display: grid; gap: 4px; align-content: start; min-width: 0; padding: 9px 11px 9px 15px; border-radius: 10px;
  background: var(--surface); color: var(--ink); border: 1px solid var(--edge-strong); text-align: left;
  user-select: none; -webkit-user-select: none; cursor: grab;
  transition: opacity 0.2s, box-shadow 0.2s, transform 0.2s, border-color 0.2s;
}
.pcourse::before, .ptile::before { content: ''; position: absolute; left: 4px; top: 8px; bottom: 8px; width: 3px; border-radius: 4px; background: var(--c, var(--edge-strong)); }
.pcourse:hover, .ptile:hover { box-shadow: var(--shadow-lg); transform: translateY(-1px); border-color: color-mix(in oklab, var(--c, var(--ink-3)) 45%, var(--edge-strong)); }
.pcourse:active, .ptile:active { cursor: grabbing; }
.pcourse .top, .ptile .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.pcourse .k, .ptile .k, .tile-ph .k { font: 700 12px var(--mono); letter-spacing: 0.02em; opacity: 0.9; }
.pcourse .cr, .ptile .cr { font: 650 11.5px var(--display); padding: 1px 7px; border-radius: 999px; background: var(--c, var(--surface-3)); color: var(--on, var(--ink)); white-space: nowrap; }
/* One size for every card: two lines of name at most, one line under it. */
.pcourse, .ptile, .tile-ph { height: var(--tile-h, 102px); }
.pcourse, .ptile-body { grid-template-rows: auto minmax(0, 1fr) auto; }
.ptile-body { height: 100%; }
.pcourse .nm, .ptile .nm {
  font-weight: 650; font-size: 13.5px; line-height: 1.3; overflow-wrap: anywhere; align-self: start;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden;
}
.pcourse .sub, .ptile .sub { font-size: 12px; color: var(--ink-3); display: flex; gap: 6px; align-items: center; min-width: 0; overflow: hidden; white-space: nowrap; }
.pcourse .sub > *, .ptile .sub > * { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.ptile .sub .rt { flex: none; max-width: 100%; }
.pcourse .sub .icon, .ptile .sub .icon, .ptile .rt .icon { width: 13px; height: 13px; }
.pcourse .mark { display: inline-flex; align-items: center; gap: 4px; }
.pcourse { padding-right: 34px; }
.pcourse .add-btn {
  position: absolute; right: 6px; bottom: 6px; width: 26px; height: 26px; display: grid; place-items: center; padding: 0;
  border: 0; border-radius: 8px; background: var(--c-soft); color: var(--c-ink); cursor: pointer; opacity: 0.85; transition: background 0.15s, color 0.15s, transform 0.15s;
}
.pcourse .add-btn:hover { background: var(--c); color: var(--on); transform: scale(1.08); opacity: 1; }
.pcourse.slot, .ptile.slot { background: var(--surface-2); color: var(--ink-2); border-style: dashed; box-shadow: none; }
.pcourse.slot::before, .ptile.slot::before { display: none; }
.pcourse.slot .cr, .ptile.slot .cr { background: var(--surface-3); color: var(--ink); }
.ptile.locked { cursor: default; border-color: transparent; box-shadow: inset 0 0 0 2px var(--c); }
.ptile.locked::before { display: none; }
.ptile.locked:hover { transform: none; box-shadow: inset 0 0 0 2px var(--c); }
.ptile.locked .k { color: var(--c-ink); opacity: 1; }
.ptile.locked .sub { color: var(--c-ink); font-weight: 600; }
.ptile.has-violation { outline: 2px solid var(--bad); outline-offset: 2px; }
.ptile.has-flag { outline: 2px dashed var(--warn); outline-offset: 2px; }
.ptile .rt { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: color-mix(in oklab, var(--warn) 78%, var(--ink)); }
.flag-badge {
  position: absolute; top: -9px; right: -9px; z-index: 1; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center;
  background: var(--bad); color: #fff; border: 1px solid var(--edge); font: 700 12px var(--display); animation: badge-in 0.3s cubic-bezier(0.3, 1.6, 0.5, 1);
}
.ptile.lifted { outline: 2px solid var(--info); outline-offset: 2px; transform: translateY(-3px) scale(1.02); box-shadow: var(--shadow-lg); }
.pcourse.dragging-src, .ptile.dragging-src { opacity: 0.3; transform: none; box-shadow: none; }
.ptile-body { display: grid; gap: 4px; min-width: 0; }
.ptile-acts {
  position: absolute; right: 6px; bottom: 6px; display: flex; gap: 2px; padding: 2px; border-radius: 9px;
  background: var(--surface); border: 1px solid var(--edge); box-shadow: var(--shadow-sm); opacity: 0; transform: translateY(3px);
  transition: opacity 0.15s, transform 0.15s; pointer-events: none;
}
.ptile:hover .ptile-acts, .ptile:focus-within .ptile-acts, .ptile.lifted .ptile-acts { opacity: 1; transform: none; pointer-events: auto; }
.ptile-acts button { width: 24px; height: 24px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 7px; background: none; color: var(--ink-2); cursor: pointer; }
.ptile-acts button:hover:not(:disabled) { background: var(--surface-2); color: var(--ink); }
.ptile-acts button.rm:hover { background: color-mix(in oklab, var(--bad) 12%, var(--surface)); color: var(--bad); }
.ptile-acts button:disabled { opacity: 0.35; cursor: default; }
@media (hover: none) { .ptile-acts { opacity: 1; transform: none; pointer-events: auto; } }

/* The dragged copy and the place it would land */
.ghost-tile {
  /* No transition: the tile's own hover easing would make the copy trail the pointer and smooth away its lean. */
  transition: none !important;
  position: fixed; left: 0; top: 0; z-index: 95; margin: 0; list-style: none; pointer-events: none; box-shadow: var(--shadow-lg);
  will-change: transform; transform-origin: 40% 50%; animation: lift 0.2s ease-out;
}
.ghost-tile .ptile-acts, .ghost-tile .add-btn { display: none; }
@keyframes lift { from { box-shadow: var(--shadow-sm); } }
body.dragging, body.dragging * { cursor: grabbing !important; }
.tile-ph {
  align-self: stretch; min-height: 64px; border-radius: 10px; border: 2px dashed var(--c, var(--ink-3)); background: var(--c-air, var(--surface-2));
  display: flex; flex-direction: column; justify-content: center; gap: 2px; padding: 8px 12px; color: var(--c-ink, var(--ink-2));
  animation: ph-in 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.tile-ph .cr { font: 700 16px var(--display); letter-spacing: -0.01em; }
@keyframes ph-in { from { opacity: 0; transform: scale(0.85); } }

/* Term rows: the term, its load and meter on the left, its tiles on the right */
.rows { display: grid; gap: 10px; }
.trow {
  position: relative; display: grid; grid-template-columns: 228px minmax(0, 1fr); gap: 20px; align-items: start;
  padding: 14px 16px; background: var(--surface); border: 1px solid var(--edge); border-radius: 14px;
  transition: opacity 0.2s, filter 0.2s, border-color 0.2s, background 0.2s, box-shadow 0.25s;
}
.trow-l { display: grid; gap: 8px; align-content: start; min-width: 0; }
.trow.past { background: var(--surface-2); }
.trow.past .codes { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 5px; align-content: flex-start; }
.trow.past .code { border: 0; cursor: pointer; padding: 2px 7px; transition: transform 0.15s, box-shadow 0.15s; }
.trow.past .code:hover { transform: translateY(-1px); box-shadow: 0 2px 0 color-mix(in oklab, var(--c) 45%, transparent); }
.trow.now { background: color-mix(in oklab, var(--info) 6%, var(--surface)); }
.trow.has-violation { border-color: color-mix(in oklab, var(--bad) 45%, var(--edge)); }
.trow.has-flag { border-color: color-mix(in oklab, var(--warn) 45%, var(--edge)); }
.tname { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
.tname h3 { font: 700 15.5px var(--display); letter-spacing: -0.01em; }
.tname .when { flex-basis: 100%; font-size: 12px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.tload { font-size: 12.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.tload b { display: inline-block; font: 700 20px var(--display); color: var(--ink); letter-spacing: -0.02em; transition: color 0.2s, transform 0.2s; }
.tload.up b { color: var(--info); transform: translateY(-1px); }
.tload.down b { color: var(--ink-3); }
.tload .delta { margin-left: 6px; font-weight: 750; font-size: 13px; animation: rise 0.2s ease-out; }
.tload .delta.up { color: var(--info); }
.tload .delta.down { color: var(--ink-3); }
.tiles { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; align-content: start; min-width: 0; }
.drop-hint { border: 1px dashed var(--edge-strong); border-radius: 12px; padding: 18px 12px; text-align: center; color: var(--ink-3); font-size: 12.5px; grid-column: 1 / -1; }
.add-row {
  display: flex; justify-content: center; align-items: center; gap: 8px; width: 100%; border: 1px dashed var(--edge-strong); border-radius: 14px; background: transparent; cursor: pointer;
  font: inherit; font-weight: 650; color: var(--ink-2); padding: 16px; transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.add-row:hover { background: var(--surface); color: var(--ink); border-color: var(--edge-strong); }
.row-enter-active { transition: opacity 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1); }
.row-enter-from { opacity: 0; transform: translateY(-10px) scale(0.99); }

/* Credit meter: ticks at the minimum and the maximum; a pulsing segment for what a drop would add or take away */
.cap { position: relative; padding-bottom: 16px; margin-top: 2px; }
.cap .track { display: block; position: relative; height: 8px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
.cap .fill, .cap .pre { position: absolute; top: 0; bottom: 0; left: 0; transition: width 0.34s cubic-bezier(0.2, 0.8, 0.2, 1), left 0.34s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 0.25s; }
.cap .fill { border-radius: 999px; background: var(--ink-3); animation: grow 0.7s cubic-bezier(0.2, 0.8, 0.2, 1); }
.cap.ok .fill, .cap.ok .pre:not(.minus) { background: var(--ok); }
.cap.under .fill, .cap.under .pre:not(.minus) { background: var(--warn); }
.cap.over .fill, .cap.over .pre:not(.minus) { background: var(--bad); }
.cap .pre { width: 0; border-radius: 0 999px 999px 0; background: var(--ok); opacity: 0.5; }
.cap.preview .pre { animation: pre-pulse 0.9s ease-in-out infinite alternate; }
.cap .pre.minus { background: var(--ink-3); opacity: 0.22; animation: none; }
.cap .tick { position: absolute; top: -3px; width: 2px; height: 14px; margin-left: -1px; border-radius: 2px; background: var(--edge-strong); }
.cap .tick.max { background: var(--ink-3); }
.cap .tick em { position: absolute; top: 15px; left: 50%; transform: translateX(-50%); font: 600 10.5px var(--font); font-style: normal; color: var(--ink-3); }
@keyframes grow { from { width: 0; } }
@keyframes pre-pulse { from { opacity: 0.35; } to { opacity: 0.75; } }

/* Each row while a course is dragged: green or red with the engine's reason, shown on the row under the pointer */
.drop-reason {
  display: none; align-items: flex-start; gap: 6px; margin: 0; padding: 6px 10px; border-radius: 10px;
  font-size: 12px; font-weight: 650; line-height: 1.4; background: var(--surface-2); color: var(--ink-2);
}
.drop-reason .icon { flex: none; width: 14px; height: 14px; margin-top: 1px; }
.trow.over .drop-reason { display: flex; animation: rise 0.2s ease-out; }
.trow.checking .drop-reason .icon { animation: spin 0.9s linear infinite; }
.trow.ok-drop, .tray.ok-drop { border-color: color-mix(in oklab, var(--ok) 40%, var(--edge)); background: color-mix(in oklab, var(--ok) 3%, var(--surface)); box-shadow: 0 0 0 2px color-mix(in oklab, var(--ok) 22%, transparent); }
.trow.warn-drop { border-color: color-mix(in oklab, var(--warn) 45%, var(--edge)); box-shadow: 0 0 0 2px color-mix(in oklab, var(--warn) 20%, transparent); }
.trow.bad-drop { border-color: color-mix(in oklab, var(--bad) 35%, var(--edge)); box-shadow: 0 0 0 2px color-mix(in oklab, var(--bad) 18%, transparent); }
.trow.over.ok-drop, .tray.over.ok-drop { background: color-mix(in oklab, var(--ok) 6%, var(--surface)); box-shadow: 0 0 0 3px color-mix(in oklab, var(--ok) 30%, transparent), var(--shadow-lg); }
.trow.over.warn-drop { background: color-mix(in oklab, var(--warn) 6%, var(--surface)); box-shadow: 0 0 0 3px color-mix(in oklab, var(--warn) 28%, transparent), var(--shadow-lg); }
.trow.over.bad-drop { background: color-mix(in oklab, var(--bad) 5%, var(--surface)); box-shadow: 0 0 0 3px color-mix(in oklab, var(--bad) 28%, transparent), var(--shadow-lg); }
.trow.ok-drop .drop-reason, .tray.ok-drop .drop-reason { background: color-mix(in oklab, var(--ok) 14%, var(--surface)); color: color-mix(in oklab, var(--ok) 80%, var(--ink)); }
.trow.warn-drop .drop-reason { background: color-mix(in oklab, var(--warn) 14%, var(--surface)); color: color-mix(in oklab, var(--warn) 78%, var(--ink)); }
.trow.unknown-drop { border-color: color-mix(in oklab, var(--info) 35%, var(--edge)); box-shadow: 0 0 0 2px color-mix(in oklab, var(--info) 16%, transparent); }
.trow.over.unknown-drop { background: color-mix(in oklab, var(--info) 5%, var(--surface)); box-shadow: 0 0 0 3px color-mix(in oklab, var(--info) 26%, transparent), var(--shadow-lg); }
.trow.unknown-drop .drop-reason { background: color-mix(in oklab, var(--info) 12%, var(--surface)); color: color-mix(in oklab, var(--info) 80%, var(--ink)); }
.trow.bad-drop .drop-reason { background: color-mix(in oklab, var(--bad) 12%, var(--surface)); color: color-mix(in oklab, var(--bad) 85%, var(--ink)); }
.trow.home { opacity: 0.85; }
.trow.failed-drop .drop-reason { background: var(--surface-2); color: var(--ink-3); }
.trow.stale .tload, .trow.stale .cap, .trow.stale .row-issues { opacity: 0.55; }
@keyframes rise { from { opacity: 0; transform: translateY(-4px); } }
@keyframes spin { to { transform: rotate(360deg); } }

/* A term's own issues: a short title each, the words in the tooltip */
.row-issues { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 5px; }
.ri { display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px 2px 6px; border-radius: 999px; font-size: 12px; font-weight: 650; cursor: help; }
.ri .icon { width: 13px; height: 13px; }
.ri.violation { background: color-mix(in oklab, var(--bad) 12%, var(--surface)); color: color-mix(in oklab, var(--bad) 82%, var(--ink)); }
.ri.flag { background: color-mix(in oklab, var(--warn) 14%, var(--surface)); color: color-mix(in oklab, var(--warn) 76%, var(--ink)); }
.ri.unknown { background: transparent; border: 1px dashed var(--edge-strong); color: var(--ink-3); }

/* The bin: drop a placed course on it to send it back to the course list */
.drop-bin {
  position: fixed; left: 50%; bottom: 24px; z-index: 96; transform: translateX(-50%); display: flex; align-items: center; gap: 12px;
  padding: 12px 22px 12px 12px; border-radius: 18px; background: var(--surface); border: 2px dashed var(--edge-strong); box-shadow: var(--shadow-lg);
  color: var(--ink-2); transition: transform 0.22s cubic-bezier(0.3, 1.4, 0.5, 1), background 0.2s, border-color 0.2s, color 0.2s;
}
.drop-bin .ic { width: 44px; height: 44px; border-radius: 13px; display: grid; place-items: center; background: var(--surface-2); color: var(--ink-2); transition: background 0.2s, color 0.2s; }
.drop-bin b { display: block; font-size: 14.5px; color: var(--ink); }
.drop-bin small { display: block; font-size: 12px; color: var(--ink-3); }
.drop-bin.over { transform: translateX(-50%) scale(1.08); border-color: var(--bad); border-style: solid; background: color-mix(in oklab, var(--bad) 8%, var(--surface)); }
.drop-bin.over .ic { background: var(--bad); color: #fff; animation: wiggle 0.5s ease-in-out; }
.drop-bin.over b { color: color-mix(in oklab, var(--bad) 85%, var(--ink)); }
.bin-enter-active, .bin-leave-active { transition: opacity 0.22s, transform 0.28s cubic-bezier(0.3, 1.3, 0.5, 1); }
.bin-enter-from, .bin-leave-to { opacity: 0; transform: translate(-50%, 40px) scale(0.9); }
@keyframes wiggle { 20% { transform: rotate(-12deg); } 40% { transform: rotate(10deg); } 60% { transform: rotate(-6deg); } 80% { transform: rotate(3deg); } }
@keyframes badge-in { from { transform: scale(0); } }

.num { font-weight: 750; font-variant-numeric: tabular-nums; }
@media (max-width: 1180px) {
  .planner-layout, .planner-layout.rail-mini { grid-template-columns: minmax(0, 1fr); }
  .planner-layout .issues-panel { position: static; max-height: none; order: -1; }
}
@media (max-width: 760px) {
  .trow { grid-template-columns: minmax(0, 1fr); gap: 12px; padding: 14px; }
}
@media (max-width: 620px) {
  .tiles, .tray-list { grid-template-columns: 1fr; }
  .tray-tools .add-to { flex: 1 1 100%; }
  .planner-page .kbd-hint { white-space: normal; }
  .drop-bin { bottom: 16px; }
}
</style>
