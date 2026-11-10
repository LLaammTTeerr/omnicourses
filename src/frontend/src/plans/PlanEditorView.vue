<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from 'vue';
import { RouterLink } from 'vue-router';
import { HttpError, statusOf } from '../api.js';
import { useAsyncLoad } from '../async-load.js';
import { useAuth } from '../auth/store.js';
import { fetchCurriculum, type CurriculumCourse } from '../curriculum/api.js';
import { courseName, groupColour, matches, orderGroups } from '../curriculum/present.js';
import { groupClass, type GroupId } from '../groups.js';
import { useLocale, useMessages } from '../locale.js';
import { useOnboarding } from '../onboarding/store.js';
import { usePageTitle } from '../page-title.js';
import Icon from '../shell/Icon.vue';
import { useTranscriptCodes } from '../transcript/codes.js';
import { currentTerm, termKey, termName, vietnamDate, type Term } from '../terms.js';
import { fetchPlan, fetchPlanIssues, savePlacements, type Plan, type PlanIssue, type PlanIssueCode, type PlanTermLoad } from './api.js';
import {
  addCourse,
  attachIssues,
  compareTerms,
  boardBody,
  boardOf,
  findTile,
  moveTile,
  nextTerm,
  placedCodes,
  removeTile,
  rowsFor,
  sameTiles,
  withNextRow,
  type AttachedIssues,
  type Board,
  type Row,
  type Tile,
} from './board.js';
import IssuesPanel from './IssuesPanel.vue';
import { PLANNER_MESSAGES, type IssueContext } from './messages.js';
import { KIND_STYLE, strongest } from './present.js';

// The plan editor (F5, UC-05): one row per term, the curriculum's courses to add, and moves by button, keyboard
// (Space, arrows, Enter, Escape: UC-05 A1) or drag and drop. Each change saves the whole board (ADR 0014), then the
// rule engine's report is read again from GET /plans/{id}/issues. The editor never judges a placement, a load or a
// requirement itself (AGENTS.md hard rule 1): rows and tiles change colour, and loads and caps appear, only from
// that report. A report is pinned to the board it was computed for, so its issues follow their tiles, and they are
// dimmed while the board on screen holds other tiles than that one.
const props = defineProps<{ id: string }>();
const auth = useAuth();
const onboarding = useOnboarding();
const locale = useLocale();
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

async function check(snapshot: Board): Promise<void> {
  const call = ++checkCall;
  const { id } = opened;
  issuesStatus.value = 'loading';
  try {
    const report = await auth.authed((token) => fetchPlanIssues(token, id));
    if (call !== checkCall) return;
    issues.value = attachIssues(snapshot, report);
    issuesStatus.value = 'idle';
  } catch (e) {
    if (call !== checkCall) return;
    if (statusOf(e) !== 401) console.error('Checking the plan failed:', e);
    issuesStatus.value = 'failed';
  }
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
    board.value = saved.value;
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

function change(next: Board, said?: string): void {
  if (next === board.value) return;
  board.value = next;
  saveError.value = null;
  if (said) announce(said);
  void save();
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
    const found = await auth.authed((token) => fetchPlan(token, mine.id));
    // The rows run to the target graduation term; without onboarding answers they stop at the plan's last term.
    const target = await onboarding.load().then(
      (answers) => answers.targetGraduationTerm,
      () => null,
    );
    // A later load owns the editor now; useAsyncLoad drops this answer too.
    if (mine !== opened) return found;
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
/** Each course of the curriculum once, in the group order of the explorer. */
const catalog = computed(() => {
  const courses = new Map<string, CourseInfo>();
  for (const group of orderGroups(curriculum.data.value?.requirementGroups ?? [])) {
    const colour = groupColour(group);
    for (const course of group.courses) if (!courses.has(course.code)) courses.set(course.code, { course, colour });
  }
  return courses;
});
const groupNames = computed(() => new Map((curriculum.data.value?.requirementGroups ?? []).map((g) => [g.id, g])));
// A neutral mark on the courses of the student's saved transcript, as in the explorer: whether one counts as passed
// is the engine's call (it flags a placed one as already_passed). No transcript, or none loaded, shows no marks.
const transcriptCodes = useTranscriptCodes('the planner');

function tileTitle(tile: Tile): string {
  const p = tile.placement;
  if (p.kind === 'course') return p.courseCode ?? '?';
  return m.value.slot(groupNames.value.get(p.requirementGroupId ?? '')?.name ?? m.value.slotGroupUnknown);
}

const ctx = computed<IssueContext>(() => ({
  requirementName: (issue: PlanIssue) => {
    const coverage = issues.value?.report.coverage;
    if (issue.requirementGroupId) return coverage?.groups.find((g) => g.id === issue.requirementGroupId)?.name ?? null;
    if (issue.combinedMinimumId) return coverage?.combinedMinimums.find((c) => c.id === issue.combinedMinimumId)?.name ?? null;
    return null;
  },
}));

// ---------- What each row and tile shows, worked out once per change ----------
interface TileView {
  tile: Tile;
  title: string;
  label: string;
  credits: number | null;
  name: string | null;
  classes: string[];
  /** Violations, then flags. */
  issues: PlanIssue[];
  unknowns: PlanIssueCode[];
}
interface RowView {
  row: Row;
  key: string;
  name: string;
  summer: boolean;
  load: { text: string; caps: string } | null;
  meter: { fill: number; min: number | null; max: number } | null;
  tone: string;
  issues: PlanIssue[];
  tiles: TileView[];
}

const toneOf = (issues: readonly PlanIssue[]) => {
  const kind = strongest(issues.filter((i) => i.kind !== 'unknown'));
  return kind ? `has-${kind}` : '';
};

function tileView(tile: Tile, termName: string): TileView {
  const p = tile.placement;
  const info = p.courseCode ? catalog.value.get(p.courseCode) : undefined;
  const slotGroup = p.kind === 'slot' ? groupNames.value.get(p.requirementGroupId ?? '') : undefined;
  const colour = info?.colour ?? (slotGroup ? groupColour(slotGroup) : null);
  const all = issues.value?.byTile.get(tile.key) ?? [];
  const title = tileTitle(tile);
  return {
    tile,
    title,
    label: m.value.tileLabel(title, termName),
    credits: p.kind === 'slot' ? (p.credits ?? null) : (info?.course.credits ?? null),
    name: info ? courseName(info.course, locale.lang) : null,
    classes: ['ptile', colour ? groupClass(colour) : 'g-none', p.kind === 'slot' ? 'slot' : '', toneOf(all)],
    issues: [...all.filter((i) => i.kind === 'violation'), ...all.filter((i) => i.kind === 'flag')],
    unknowns: all.filter((i) => i.kind === 'unknown').map((i) => i.code),
  };
}

/** The meter runs a little past the maximum, so a load above it still shows. Drawing only: the engine compares. */
function meter(load: PlanTermLoad | null): RowView['meter'] {
  if (!load?.caps) return null;
  const scale = load.caps.max + 6;
  const pct = (n: number) => Math.min(100, (n / scale) * 100);
  return { fill: pct(load.credits), min: load.caps.min === null ? null : pct(load.caps.min), max: pct(load.caps.max) };
}

function rowView(row: Row): RowView {
  const key = termKey(row.term);
  const name = nameOf(row.term);
  const rowIssues = issues.value?.byTerm.get(key) ?? [];
  const load = issues.value?.loads.get(key) ?? null;
  // The engine reports a load with a course of unknown credits as a lower bound (load_not_checked).
  const atLeast = rowIssues.some((i) => i.code === 'load_not_checked');
  return {
    row,
    key,
    name,
    summer: load?.kind === 'summer',
    load: load && {
      text: atLeast ? m.value.loadAtLeast(load.credits) : m.value.load(load.credits),
      caps: load.caps ? m.value.caps(load.caps.min, load.caps.max) : m.value.capsUnknown,
    },
    meter: meter(load),
    tone: toneOf(rowIssues),
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
const addTarget = ref('');
const addTargetTerm = computed(() => board.value.find((row) => termKey(row.term) === addTarget.value)?.term ?? board.value[0]?.term ?? null);
const unplaced = computed(() => {
  const placed = placedCodes(board.value);
  return [...catalog.value.values()].filter(({ course }) => !placed.has(course.code));
});
const shown = computed(() => unplaced.value.filter(({ course }) => matches(query.value, course.code, course.nameVi, course.nameEn)));

function add(code: string, to: Term | null = addTargetTerm.value): void {
  if (!to) return;
  change(addCourse(board.value, code, to, newKey()), m.value.added(code, nameOf(to)));
}

/** An empty row is not stored (ADR 0014): adding one saves nothing, and a report of the board still describes it. */
function addRow(): void {
  const before = board.value;
  const next = withNextRow(before);
  board.value = next;
  if (saved.value === before) saved.value = next;
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
    } else if (event.key === 'Enter' || event.key === ' ') {
      const to = board.value[current.target]!.term;
      lifted.value = null;
      if (current.target === rowIndex) announce(m.value.liftCancelled(title));
      else change(moveTile(board.value, tile.key, to), m.value.moved(title, nameOf(to)));
      void focusTile(tile.key);
    } else if (event.key === 'Escape') {
      lifted.value = null;
      announce(m.value.liftCancelled(title));
    } else return;
    event.preventDefault();
    return;
  }
  if (event.key === ' ') {
    lifted.value = { key: tile.key, target: rowIndex };
    announce(m.value.lifted(title, nameOf(board.value[rowIndex]!.term)));
  } else if (event.key === 'Delete') {
    remove(tile);
  } else return;
  event.preventDefault();
}
function onTileBlur(tile: Tile): void {
  if (lifted.value?.key === tile.key) lifted.value = null;
}

// Drag and drop, for a pointer: a tile or a course of the list onto a row, or a tile back onto the list to remove it.
const dragging = shallowRef<{ key: number } | { code: string } | null>(null);
const dropRow = ref<string | null>(null);
function startDrag(event: DragEvent, what: { key: number } | { code: string }): void {
  dragging.value = what;
  event.dataTransfer?.setData('text/plain', 'key' in what ? String(what.key) : what.code);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}
function endDrag(): void {
  dragging.value = null;
  dropRow.value = null;
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

usePageTitle(() => plan.value?.name ?? m.value.title);
</script>

<template>
  <div class="page planner-page">
    <header class="page-head">
      <div>
        <p class="crumbs"><RouterLink :to="{ name: 'plans' }">{{ m.allPlans }}</RouterLink></p>
        <h1>{{ plan?.name ?? m.title }}</h1>
        <p>{{ m.editorLead }}</p>
        <p class="small t3">{{ m.keyboardHint }}</p>
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
      <div class="planner-status">
        <span class="chip" :class="{ bad: saveState === 'failed', ok: saveState === 'saved' }" role="status" data-test="save-state">
          <Icon :name="saveState === 'failed' ? 'alert' : saveState === 'saved' ? 'check' : 'info'" size="sm" />
          {{ saveState === 'saving' ? m.saving : saveState === 'saved' ? m.saved : m.notSaved }}
        </span>
        <span class="small t3">{{ m.curriculum(plan.curriculum.code) }}</span>
      </div>
      <p v-if="saveError" class="callout bad" role="alert" data-test="save-error"><Icon name="alert" /><span>{{ saveError }}</span></p>

      <div class="planner-layout">
        <div class="planner-main">
          <section class="card tray" aria-labelledby="tray-title" data-test="tray" :class="{ 'drop-ok': dragging && 'key' in dragging }" @dragover="overList" @drop.prevent="dropOnList">
            <div class="tray-head">
              <h2 id="tray-title">{{ m.courses }}</h2>
              <span v-if="curriculum.status.value === 'loaded'" class="chip">{{ m.coursesCount(unplaced.length) }}</span>
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
                :data-test="`pool-${course.code}`"
                @dragstart="startDrag($event, { code: course.code })"
                @dragend="endDrag"
              >
                <span class="k">{{ course.code }}</span>
                <span class="nm">
                  {{ courseName(course, locale.lang) }}
                  <span v-if="transcriptCodes.has(course.code)" class="mark" data-test="in-transcript"><Icon name="file" size="sm" />{{ m.inTranscript }}</span>
                </span>
                <span class="cr">{{ m.credits(course.credits) }}</span>
                <button
                  class="btn sm ghost icon-only"
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
          </section>

          <div class="rows" role="list" :aria-label="m.termsLabel">
            <section
              v-for="(row, r) in rows"
              :key="row.key"
              role="listitem"
              :class="['trow', row.tone, { 'drop-target': dropRow === row.key || lifted?.target === r, stale: !fresh }]"
              :aria-labelledby="`term-${row.key}`"
              :data-test="`term-${row.key}`"
              @dragover="overRow($event, row.row.term)"
              @dragleave="leaveRow"
              @drop.prevent="dropOnRow(row.row.term)"
            >
              <div class="trow-h">
                <div class="tname">
                  <h3 :id="`term-${row.key}`">{{ row.name }}</h3>
                  <span v-if="row.summer" class="chip info">{{ m.summer }}</span>
                </div>
                <div v-if="row.load" class="tload" data-test="load">
                  <b>{{ row.load.text }}</b>
                  <span class="t3"> · {{ row.load.caps }}</span>
                </div>
                <div v-if="row.meter" class="tmeter" aria-hidden="true">
                  <span class="track"><i class="fill" :style="{ width: `${row.meter.fill}%` }" /></span>
                  <span v-if="row.meter.min !== null" class="tick" :style="{ left: `${row.meter.min}%` }" />
                  <span class="tick max" :style="{ left: `${row.meter.max}%` }" />
                </div>
              </div>
              <ul v-if="row.issues.length" class="row-issues">
                <li v-for="(issue, i) in row.issues" :key="i" :class="['ri', issue.kind]" :data-test="`row-issue-${issue.kind}`">
                  <Icon :name="KIND_STYLE[issue.kind].icon" size="sm" />
                  <span><span class="sr-only">{{ m.kinds[issue.kind] }}: </span>{{ m.issue[issue.code](issue, ctx) }} <span class="cite">{{ issue.citation }}</span></span>
                </li>
              </ul>
              <ul class="tiles">
                <li
                  v-for="t in row.tiles"
                  :id="`tile-${t.tile.key}`"
                  :key="t.tile.key"
                  :class="[t.classes, { lifted: lifted?.key === t.tile.key }]"
                  tabindex="0"
                  draggable="true"
                  :aria-label="t.label"
                  :aria-describedby="`tile-${t.tile.key}-body`"
                  aria-roledescription="draggable"
                  :data-test="`tile-${t.tile.placement.courseCode ?? 'slot'}`"
                  @keydown="onTileKey($event, t.tile, r)"
                  @blur="onTileBlur(t.tile)"
                  @dragstart="startDrag($event, { key: t.tile.key })"
                  @dragend="endDrag"
                >
                  <div :id="`tile-${t.tile.key}-body`" class="ptile-body">
                    <span class="top">
                      <span class="k">{{ t.title }}</span>
                      <span v-if="t.credits !== null" class="cr">{{ m.credits(t.credits) }}</span>
                    </span>
                    <span v-if="t.name" class="nm">{{ t.name }}</span>
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
                <li v-if="row.tiles.length === 0" class="drop-hint">{{ m.dropHere }}</li>
              </ul>
            </section>
          </div>
          <button v-if="board.length" class="btn add-row" type="button" data-test="add-row" @click="addRow">
            <Icon name="plus" size="sm" />{{ m.addTerm(nameOf(nextTerm(board[board.length - 1]!.term))) }}
          </button>
        </div>

        <IssuesPanel :attached="issues" :status="issuesStatus" :fresh="fresh" :ctx="ctx" @retry="check(saved)" @focus-tile="focusTile" />
      </div>
    </template>

    <p class="sr-only" aria-live="polite" data-test="announcer">{{ announcement }}</p>
  </div>
</template>

<style>
.planner-page { max-width: 1480px; }
.planner-status { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.planner-layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; align-items: start; }
.planner-main { display: grid; gap: 14px; min-width: 0; }
.planner-layout .issues-panel { position: sticky; top: 16px; max-height: calc(100vh - 32px); overflow-y: auto; }
.tray { display: grid; gap: 10px; }
.tray.drop-ok { outline: 2px dashed var(--info); }
.tray-head { display: flex; align-items: center; gap: 10px; }
.tray-head h2 { font-size: 17px; }
.tray-tools { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
.tray-tools .search { position: relative; flex: 1 1 240px; display: block; }
.tray-tools .search .icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--ink-3); }
.tray-tools .search .input { padding-left: 36px; }
.tray-tools .add-to { flex: 0 1 220px; }
.tray-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; max-height: 260px; overflow-y: auto; }
.pcourse {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; gap: 10px; align-items: center; padding: 4px 6px 4px 14px;
  border-radius: 10px; border: 1px solid var(--edge); background: var(--surface); position: relative; cursor: grab;
}
.pcourse::before { content: ''; position: absolute; left: 5px; top: 8px; bottom: 8px; width: 3px; border-radius: 3px; background: var(--c); }
.pcourse .k, .ptile .k { font: 700 12px var(--mono); color: var(--c-ink, var(--ink)); }
.pcourse .nm { font-size: 13.5px; overflow-wrap: anywhere; }
.pcourse .mark { display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; font-size: 12px; color: var(--ink-3); white-space: nowrap; }
.pcourse .mark .icon { width: 13px; height: 13px; }
.pcourse .cr { font-size: 12px; color: var(--ink-3); white-space: nowrap; }
.rows { display: grid; gap: 10px; }
.trow { border: 1px solid var(--edge); border-radius: 14px; background: var(--surface); padding: 12px 14px; display: grid; gap: 10px; }
.trow.has-violation { border-color: color-mix(in oklab, var(--bad) 55%, var(--edge)); }
.trow.has-flag { border-color: color-mix(in oklab, var(--warn) 55%, var(--edge)); }
.trow.drop-target { outline: 2px dashed var(--info); outline-offset: 2px; }
.trow.stale .tload, .trow.stale .tmeter, .trow.stale .row-issues, .trow.stale .tile-issues { opacity: 0.55; }
.trow-h { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 14px; align-items: center; }
.tname { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.tname h3 { font-size: 15px; }
.tload { font-size: 13.5px; white-space: nowrap; }
.tmeter { grid-column: 1 / -1; position: relative; height: 8px; }
.tmeter .track { display: block; height: 8px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
.tmeter .fill { display: block; height: 100%; background: var(--ok); transition: width 0.2s; }
.trow.has-flag .tmeter .fill { background: var(--warn); }
.tmeter .tick { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--ink-3); border-radius: 2px; }
.row-issues, .tile-issues { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.ri, .ti { display: flex; gap: 6px; align-items: flex-start; font-size: 12.5px; line-height: 1.35; }
.ri .icon, .ti .icon { flex: none; margin-top: 1px; width: 14px; height: 14px; }
.ri.violation, .ti.violation { color: color-mix(in oklab, var(--bad) 82%, var(--ink)); font-weight: 600; }
.ri.flag, .ti.flag { color: color-mix(in oklab, var(--warn) 78%, var(--ink)); }
.ri.unknown, .ti.unknown { color: var(--ink-3); font-style: italic; }
.ri .cite, .ti .cite { font: 500 11px var(--mono); color: var(--ink-3); }
.tiles { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
.ptile {
  position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; padding: 10px 6px 10px 16px; border-radius: 12px;
  border: 1px solid var(--edge); background: var(--surface); box-shadow: var(--shadow-sm); cursor: grab;
}
.ptile::before { content: ''; position: absolute; left: 6px; top: 10px; bottom: 10px; width: 4px; border-radius: 4px; background: var(--c, var(--edge-strong)); }
.ptile.slot { border-style: dashed; background: transparent; box-shadow: none; }
.ptile.has-violation { border: 2px solid var(--bad); }
.ptile.has-flag { border: 2px dashed var(--warn); }
.ptile.lifted { outline: 3px solid var(--info); outline-offset: 2px; transform: translateY(-2px); }
.ptile-body { display: grid; gap: 4px; min-width: 0; }
.ptile .top { display: flex; gap: 8px; align-items: center; justify-content: space-between; }
.ptile .cr { font-size: 11.5px; font-weight: 650; padding: 1px 7px; border-radius: 999px; background: var(--c, var(--surface-3)); color: var(--on, var(--ink)); white-space: nowrap; }
.ptile .nm { font-weight: 600; font-size: 13px; line-height: 1.3; overflow-wrap: anywhere; }
.ptile-acts { display: flex; flex-direction: column; gap: 2px; }
.ptile-acts .btn.sm.icon-only { width: 28px; min-height: 26px; }
.drop-hint { border: 1px dashed var(--edge-strong); border-radius: 12px; padding: 14px; text-align: center; color: var(--ink-3); font-size: 13px; }
.add-row { justify-self: start; }
@media (max-width: 1100px) {
  .planner-layout { grid-template-columns: minmax(0, 1fr); }
  .planner-layout .issues-panel { position: static; max-height: none; }
}
@media (max-width: 620px) {
  .tiles { grid-template-columns: 1fr; }
  .tray-tools .add-to { flex: 1 1 100%; }
}
</style>
