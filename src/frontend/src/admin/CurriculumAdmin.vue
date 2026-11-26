<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import { onBeforeRouteLeave, RouterLink } from 'vue-router';
import { useAuth } from '../auth/store.js';
import SelectMenu from '../components/SelectMenu.vue';
import { fetchCurriculum, fetchPrograms, type Curriculum, type CurriculumCourse, type RequirementGroup } from '../curriculum/api.js';
import { courseName, groupColour } from '../curriculum/present.js';
import { GROUPS, groupClass } from '../groups.js';
import { useLocale, useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { useToast } from '../shell/toast.js';
import {
  clearOfferingTerms,
  clearPrerequisites,
  createCohort,
  createGroup,
  deleteGroup,
  fetchAdminPrograms,
  fetchCohort,
  fetchCohorts,
  linkCourse,
  setOfferingTerms,
  setPrerequisites,
  unlinkCourse,
  updateCohort,
  updateGroup,
  updateProgram,
  type AdminProgram,
  type CohortDetails,
  type CohortRef,
} from './api.js';
import CohortDialog from './CohortDialog.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import { readFailure } from './errors.js';
import FieldErrors from './FieldErrors.vue';
import {
  COHORT_FIELDS,
  cohortChanges,
  cohortMatches,
  courseIn,
  GROUP_FIELDS,
  groupChanges,
  groupHas,
  groupMatches,
  LINK_FIELDS,
  newGroupBody,
  newCohortBody,
  PREREQUISITE_FIELDS,
  PROGRAM_FIELDS,
  programChanges,
  programMatches,
  sameList,
  storedCode,
  storedPrerequisites,
  TERM_FIELDS,
  type CohortValues,
  type GroupValues,
  type PrerequisiteChoice,
  type ProgramValues,
  type SavedProgram,
} from './forms.js';
import GroupDialog from './GroupDialog.vue';
import { ADMIN_MESSAGES } from './messages.js';
import OfferingTermsDialog from './OfferingTermsDialog.vue';
import PrerequisitesDialog from './PrerequisitesDialog.vue';
import { describeProblem, type ProblemView } from './problem.js';
import ProgramDialog from './ProgramDialog.vue';
import ProblemNote from './ProblemNote.vue';
import { useAdminAccess } from './store.js';
import { useWrites, type WriteOutcome } from './write.js';

// The curriculum editor of a program administrator (ADR 0011, UC-11 basic flow; UI prototypes: admin.html, "Nhóm
// yêu cầu"): the requirement groups of one granted program and cohort, the courses each links, and each course's
// prerequisites and offering terms in that cohort. Every check is the API's: the page sends what was entered and
// shows what the API answers, and it computes no academic rule (AGENTS.md hard rule 1). The program administrator
// also edits the program's details, adds a cohort and edits one (UC-11 A1; "Thêm khóa" in the prototype). The
// prototype's version line, the training type and credit-total editing have no route, so they are not here.
const auth = useAuth();
const access = useAdminAccess();
const locale = useLocale();
const toast = useToast();
const m = useMessages(ADMIN_MESSAGES);
const text = computed(() => m.value.curriculum);

// ---------- Program and cohort: only the ones the API lists for this user ----------
const programList = shallowRef<AdminProgram[] | null>(null);
const programsStatus = ref<'loading' | 'loaded' | 'failed'>('loading');
let programsCall = 0;

/** `quiet`: the list is replaced when the answer is in, and the page stays as it is meanwhile. */
async function loadPrograms(quiet = false): Promise<void> {
  const call = ++programsCall;
  if (!quiet) {
    programList.value = null;
    programsStatus.value = 'loading';
  }
  try {
    const { programs } = await fetchAdminPrograms();
    if (call !== programsCall) return;
    programList.value = programs;
    programsStatus.value = 'loaded';
  } catch (e) {
    if (call !== programsCall || readFailure(e).kind === 'signed_out') return;
    console.error('Loading the programs to administer failed:', e);
    if (!quiet) programsStatus.value = 'failed';
  }
}
void loadPrograms();

const picked = ref<{ programId: string; curriculumId: string | null } | null>(null);
const program = computed(() => {
  const list = programList.value ?? [];
  return list.find((item) => item.id === picked.value?.programId) ?? list[0] ?? null;
});
const cohort = computed(() => program.value?.curricula.find((item) => item.id === picked.value?.curriculumId) ?? program.value?.curricula[0] ?? null);

/** One cohort of one program: where a write goes, and where its saved data is read again. */
interface Scope {
  ref: CohortRef;
  programCode: string;
  cohortYear: number;
}
const scope = computed<Scope | null>(() =>
  program.value && cohort.value ? { ref: { programId: program.value.id, curriculumId: cohort.value.id }, programCode: program.value.code, cohortYear: cohort.value.cohortYear } : null,
);
const onScreen = (of: Scope): boolean => scope.value?.ref.curriculumId === of.ref.curriculumId;

// The program grants changed (one was revoked, or given): offer the programs the user holds now. While a refused
// save is on screen the page is kept as it was (AdminView), and the list follows once the refusal has been read.
const grantedIds = computed(() => (access.grants?.programs ?? []).map((grant) => grant.programId).sort().join());
const listedIds = computed(() => (programList.value ?? []).map((item) => item.id).sort().join());
watch([grantedIds, () => access.refusal], () => {
  if (!access.refusal && access.grants && programsStatus.value === 'loaded' && grantedIds.value !== listedIds.value) void loadPrograms(true);
});

// ---------- The saved curriculum ----------
const curriculum = shallowRef<Curriculum | null>(null);
const status = ref<'loading' | 'loaded' | 'failed' | 'missing'>('loading');
/**
 * What is on screen may be older than what is saved: a reload after a save failed, or a write whose outcome is
 * not known was left without reading the saved data. No other write starts until the reload has worked.
 */
const stale = ref(false);
let latest = 0;

/**
 * Reads the saved curriculum of `of` again. When `of` is the cohort on screen it is shown, with the page kept as it
 * is meanwhile, so the focus and the open group stay; a cohort the administrator has left is read and not shown.
 * Rejects when it cannot.
 */
async function readSaved(of: Scope): Promise<Curriculum> {
  const call = onScreen(of) ? ++latest : null;
  const fresh = await fetchCurriculum(of.programCode, of.cohortYear);
  if (call !== null && call === latest && onScreen(of)) {
    curriculum.value = fresh;
    status.value = 'loaded';
    stale.value = false;
  }
  return fresh;
}

/** Opens a cohort: nothing of the cohort before it stays on screen. */
async function load(): Promise<void> {
  curriculum.value = null;
  stale.value = false;
  status.value = 'loading';
  const of = scope.value;
  if (!of) return;
  const call = latest + 1;
  try {
    await readSaved(of);
  } catch (e) {
    if (call !== latest) return;
    const failure = readFailure(e);
    if (failure.kind === 'signed_out') return;
    if (failure.kind !== 'not_found') console.error('Loading the curriculum to administer failed:', e);
    status.value = failure.kind === 'not_found' ? 'missing' : 'failed';
  }
}

/** Shows the saved values of the cohort on screen, after a write the API confirmed or on request; a failed reload is said, not hidden. */
async function showSaved(): Promise<void> {
  const of = scope.value;
  if (!of) return;
  try {
    await readSaved(of);
  } catch (e) {
    if (readFailure(e).kind === 'signed_out') return;
    console.error('Reloading the curriculum failed:', e);
    stale.value = true;
  }
}

const groups = computed(() => curriculum.value?.requirementGroups ?? []);
const openId = ref<string | null>(null);
const openGroup = computed(() => groups.value.find((group) => group.id === openId.value) ?? null);
// One group is open, as in the prototype: the first one, until another is opened.
watch(groups, (list) => {
  if (!list.some((group) => group.id === openId.value)) openId.value = list[0]?.id ?? null;
});

const colour = (group: RequirementGroup) => groupColour(group);
const glyph = (group: RequirementGroup) => GROUPS.find((item) => item.id === colour(group))!.glyph;
/** The stored total, as stored: nothing here adds credits up. */
const credits = (group: RequirementGroup) =>
  group.creditsTotal !== null ? text.value.creditsTotal(group.creditsTotal) : group.creditsTotalMin !== null ? text.value.creditsMin(group.creditsTotalMin) : m.value.notRecorded;

// A printed rule can run to a paragraph. A long one shows two lines, with a button to read all of it, so the rows
// stay short; a rule up to this length is always shown whole, so nothing is ever cut without that button.
const LONG_NOTE = 120;
const isLong = (notes: string) => notes.length > LONG_NOTE || notes.includes('\n');
const expanded = ref<ReadonlySet<string>>(new Set());
function toggleNote(groupId: string): void {
  const next = new Set(expanded.value);
  if (!next.delete(groupId)) next.add(groupId);
  expanded.value = next;
}

// ---------- Writes ----------
type Ask =
  | { type: 'group'; group: RequirementGroup | null }
  | { type: 'delete-group'; group: RequirementGroup }
  | { type: 'unlink'; group: RequirementGroup; course: CurriculumCourse }
  | { type: 'prerequisites'; course: CurriculumCourse }
  | { type: 'terms'; course: CurriculumCourse };
/** `at`: the cohort on screen when the form opened. Its write goes there, whatever is on screen when it is sent. */
const dialog = shallowRef<(Ask & { at: Scope }) | null>(null);
const dialogWrites = useWrites();
const linkWrites = useWrites();
/** A write is answered and the saved data is being shown: the dialog stays busy until then. */
const settling = ref(false);
const busy = computed(() => dialogWrites.busy.value || settling.value);
/** A lost answer that the reloaded data settled: said on the page, since the dialog has closed. */
const notice = ref<string | null>(null);
/** What became of a link sent for a cohort the administrator has since left: said on the page, with that cohort's name. */
const late = shallowRef<{ tone: 'ok' | 'bad' | 'warn'; text: string; items: string[] } | null>(null);
let opener: HTMLElement | null = null;

// A busy dialog refuses Escape, which leaves the Android back gesture to the browser: history back. Stay until
// the request answers, so its result is said. A 401 has signed the user out, who may leave.
onBeforeRouteLeave(() => !(busy.value || linkWrites.busy.value || programBusy.value) || !auth.signedIn);

/** The link form's message is about the last code sent: it goes when the administrator does something else. */
function dropLinkProblem(): void {
  // An outcome that is still unknown is not forgotten: the page says it may be out of date.
  if (linkWrites.problem.value?.outcome === 'unknown') stale.value = true;
  linkWrites.clear();
}

/** `from`: the click that asked for it. Its button gets the focus back; not every browser focuses a button on a click. */
function open(next: Ask, from: Event): void {
  const at = scope.value;
  if (!at) return;
  // First: a link whose outcome is unknown makes the page stale, and a stale page opens no form.
  dropLinkProblem();
  if (stale.value) return;
  opener = from.currentTarget instanceof HTMLElement ? from.currentTarget : null;
  dialogWrites.clear();
  notice.value = null;
  late.value = null;
  dialog.value = { ...next, at };
}

/** Closes the dialog and puts the focus back where it was, or on `fallback` when that control is gone. */
async function close(fallback = 'add-group'): Promise<void> {
  // Left with its outcome unknown: the page may not show what is saved, and says so until it is reloaded.
  if (dialogWrites.problem.value?.outcome === 'unknown') stale.value = true;
  dialog.value = null;
  dialogWrites.clear();
  await nextTick();
  (opener?.isConnected && !(opener as HTMLButtonElement).disabled ? opener : document.getElementById(stale.value ? 'curriculum-reload' : fallback))?.focus();
  opener = null;
}

/** Cancel (UC-11 A6): the draft is dropped and nothing is sent. Refused while a request is out. */
function cancel(): void {
  if (!busy.value) void close();
}

/** Ends a dialog's write: closed with its result said when it is saved, left open with the problem when it is not. */
async function finish(result: WriteOutcome<unknown>, saved: string, fallback?: string): Promise<boolean> {
  if (result.outcome !== 'saved' && result.outcome !== 'confirmed') return false;
  settling.value = true;
  try {
    // Saved for sure: show the saved values before the dialog closes. Confirmed: the reload has just been done.
    if (result.outcome === 'saved') await showSaved();
    await close(fallback);
    if (result.outcome === 'saved') toast.show(saved);
    else notice.value = m.value.problem.confirmed;
    return true;
  } finally {
    settling.value = false;
  }
}

/**
 * "Reload the data" after an unknown outcome (UC-11 A7): reads the saved curriculum again and says what it shows
 * of the same write, which is not sent again. Saved: the dialog closes with the notice. Not saved: it says so.
 */
async function recheckDialog(): Promise<void> {
  if ((await dialogWrites.recheck())?.outcome !== 'confirmed') return;
  await close();
  notice.value = m.value.problem.confirmed;
}
async function recheckLink(): Promise<void> {
  if ((await linkWrites.recheck())?.outcome !== 'confirmed') return;
  linkCode.value = '';
  notice.value = m.value.problem.confirmed;
}

async function saveGroup(entered: GroupValues): Promise<void> {
  const current = dialog.value;
  if (current?.type !== 'group') return;
  const { at } = current;
  const name = entered.name.trim();
  if (current.group) {
    const { id } = current.group;
    const body = groupChanges(current.group, entered);
    if (Object.keys(body).length === 0) {
      await close();
      toast.show(text.value.noChange);
      return;
    }
    const result = await dialogWrites.send(
      () => updateGroup(at.ref, id, body),
      async () => {
        const saved = (await readSaved(at)).requirementGroups.find((group) => group.id === id);
        return saved !== undefined && groupMatches(saved, entered);
      },
    );
    await finish(result, text.value.groupSaved(name));
    return;
  }
  // The new group is the one whose ID was not there before: a group of the same name already on screen is not it.
  const before = new Set(onScreen(at) ? groups.value.map((group) => group.id) : []);
  const isNew = (group: RequirementGroup) => !before.has(group.id) && groupMatches(group, entered);
  const result = await dialogWrites.send(
    () => createGroup(at.ref, newGroupBody(entered)),
    async () => (await readSaved(at)).requirementGroups.some(isNew),
  );
  if (await finish(result, text.value.groupCreated(name))) {
    const created = result.outcome === 'saved' ? result.value.id : groups.value.find(isNew)?.id;
    if (created) openId.value = created;
  }
}

async function removeGroup(): Promise<void> {
  const current = dialog.value;
  if (current?.type !== 'delete-group') return;
  const { at } = current;
  const { id, name } = current.group;
  const result = await dialogWrites.send(
    () => deleteGroup(at.ref, id),
    async () => !(await readSaved(at)).requirementGroups.some((group) => group.id === id),
  );
  await finish(result, text.value.groupDeleted(name));
}

const linkCode = ref('');
async function link(): Promise<void> {
  const [at, group, typed] = [scope.value, openGroup.value, linkCode.value];
  if (!at || !group || !typed.trim() || linkWrites.busy.value || stale.value) return;
  notice.value = null;
  late.value = null;
  const code = storedCode(typed);
  const result = await linkWrites.send(
    () => linkCourse(at.ref, group.id, typed),
    async () => groupHas(await readSaved(at), group.id, code),
  );
  if (!onScreen(at) || openId.value !== group.id) {
    // The administrator opened another cohort, or another group, while the request was out: the outcome is about
    // the group it was sent to, and is said with that group's name, not under the link box now on screen.
    const where = onScreen(at) ? text.value.groupLabel(at.programCode, at.cohortYear, group.name) : text.value.cohortLabel(at.programCode, at.cohortYear);
    const problem = linkWrites.problem.value && describeProblem(linkWrites.problem.value, m.value, LINK_FIELDS);
    linkWrites.clear();
    if (problem) late.value = { tone: problem.tone, text: m.value.earlier(where, problem.code === 'not_found' ? text.value.linkNotFound : problem.text), items: [...(problem.fields.courseCode ?? []), ...problem.items] };
    else if (result.outcome === 'saved' || result.outcome === 'confirmed')
      late.value = { tone: 'ok', text: m.value.earlier(where, result.outcome === 'saved' ? text.value.linked(code, group.name) : m.value.problem.confirmed), items: [] };
    return;
  }
  if (result.outcome !== 'saved' && result.outcome !== 'confirmed') return;
  linkCode.value = '';
  if (result.outcome === 'saved') {
    await showSaved();
    toast.show(text.value.linked(code, group.name));
  } else notice.value = m.value.problem.confirmed;
  await nextTick();
  document.getElementById('link-code')?.focus();
}

async function unlink(): Promise<void> {
  const current = dialog.value;
  if (current?.type !== 'unlink') return;
  const { at, group, course } = current;
  const result = await dialogWrites.send(
    () => unlinkCourse(at.ref, group.id, course.code),
    async () => !groupHas(await readSaved(at), group.id, course.code),
  );
  await finish(result, text.value.unlinked(course.code), 'link-code');
}

async function savePrerequisites(choice: PrerequisiteChoice): Promise<void> {
  const current = dialog.value;
  if (current?.type !== 'prerequisites') return;
  const { at } = current;
  const { code } = current.course;
  const want = storedPrerequisites(choice);
  const result = await dialogWrites.send(
    () => (choice.state === 'not_recorded' ? clearPrerequisites(at.ref, code) : setPrerequisites(at.ref, code, choice.state === 'none' ? [] : choice.codes)),
    async () => {
      const saved = courseIn(await readSaved(at), code);
      return saved !== null && sameList(saved.prerequisites, want);
    },
  );
  await finish(result, choice.state === 'not_recorded' ? text.value.prerequisitesCleared(code) : text.value.prerequisitesSaved(code));
}

/** No term: back to not recorded, since an offering list is never empty. */
async function saveTerms(terms: number[]): Promise<void> {
  const current = dialog.value;
  if (current?.type !== 'terms') return;
  const { at } = current;
  const { code } = current.course;
  const want = terms.length ? [...terms].sort((a, b) => a - b) : null;
  const result = await dialogWrites.send(
    () => (terms.length ? setOfferingTerms(at.ref, code, terms) : clearOfferingTerms(at.ref, code)),
    async () => {
      const saved = courseIn(await readSaved(at), code);
      return saved !== null && sameList(saved.offeringTerms, want);
    },
  );
  await finish(result, terms.length ? text.value.termsSaved(code) : text.value.termsCleared(code));
}

// ---------- The program's details and its cohorts (UC-11 A1) ----------
// Their own dialog and writes: they do not depend on the curriculum on screen, and a program with no cohort yet
// still offers "Add a cohort".
type ProgramAsk =
  | { type: 'program'; programId: string; saved: SavedProgram }
  | { type: 'add-cohort'; programId: string; programCode: string }
  | { type: 'edit-cohort'; ref: CohortRef; programCode: string; saved: CohortDetails };
const programDialog = shallowRef<ProgramAsk | null>(null);
const programWrites = useWrites();
const programSettling = ref(false);
const programBusy = computed(() => programWrites.busy.value || programSettling.value);
/** The details to edit could not be read: said in the banner, with nothing opened. */
const detailsFailed = ref<string | null>(null);
const opening = ref(false);
let programOpener: HTMLElement | null = null;

/** The program's details as the read API gives them: GET /admin/programs lists only its code and Vietnamese name. */
async function readProgram(code: string): Promise<SavedProgram | null> {
  const { programs } = await fetchPrograms();
  return programs.find((item) => item.code === code) ?? null;
}

async function openProgramDialog(load: () => Promise<ProgramAsk | null>, from: Event, failed: string): Promise<void> {
  if (opening.value || programBusy.value) return;
  programOpener = from.currentTarget instanceof HTMLElement ? from.currentTarget : null;
  detailsFailed.value = null;
  notice.value = null;
  opening.value = true;
  try {
    const next = await load();
    programWrites.clear();
    if (next) programDialog.value = next;
    else detailsFailed.value = failed;
  } catch (e) {
    if (readFailure(e).kind === 'signed_out') return;
    console.error('Loading the details to edit failed:', e);
    detailsFailed.value = failed;
  } finally {
    opening.value = false;
  }
}

function editProgram(from: Event): void {
  const of = program.value;
  if (!of) return;
  void openProgramDialog(
    async () => {
      const saved = await readProgram(of.code);
      return saved && { type: 'program', programId: of.id, saved };
    },
    from,
    m.value.programs.programLoadFailed,
  );
}

function addCohort(from: Event): void {
  const of = program.value;
  if (!of) return;
  void openProgramDialog(async () => ({ type: 'add-cohort', programId: of.id, programCode: of.code }), from, '');
}

function editCohort(from: Event): void {
  const of = scope.value;
  if (!of) return;
  void openProgramDialog(
    async () => ({ type: 'edit-cohort', ref: of.ref, programCode: of.programCode, saved: await fetchCohort(of.ref) }),
    from,
    m.value.programs.cohortLoadFailed,
  );
}

async function closeProgramDialog(): Promise<void> {
  programDialog.value = null;
  programWrites.clear();
  await nextTick();
  (programOpener?.isConnected && !(programOpener as HTMLButtonElement).disabled ? programOpener : document.getElementById('cohort-add'))?.focus();
  programOpener = null;
}

function cancelProgramDialog(): void {
  if (!programBusy.value) void closeProgramDialog();
}

/** Ends a program or cohort write: the programs are listed again, then the dialog closes with its result. */
async function finishProgram(result: WriteOutcome<unknown>, saved: string, after?: () => void): Promise<void> {
  if (result.outcome !== 'saved' && result.outcome !== 'confirmed') return;
  programSettling.value = true;
  try {
    await loadPrograms(true);
    after?.();
    await closeProgramDialog();
    if (result.outcome === 'saved') toast.show(saved);
    else notice.value = m.value.problem.confirmed;
  } finally {
    programSettling.value = false;
  }
}

async function saveProgramDetails(values: ProgramValues): Promise<void> {
  const current = programDialog.value;
  if (current?.type !== 'program') return;
  const { programId, saved } = current;
  const body = programChanges(saved, values);
  if (Object.keys(body).length === 0) {
    await closeProgramDialog();
    toast.show(m.value.programs.noChange);
    return;
  }
  const result = await programWrites.send(
    () => updateProgram(programId, body),
    async () => {
      const found = await readProgram(saved.code);
      return found !== null && programMatches(found, values);
    },
  );
  await finishProgram(result, m.value.programs.programSaved(saved.code));
}

async function saveCohort(values: CohortValues): Promise<void> {
  const current = programDialog.value;
  if (current?.type === 'edit-cohort') {
    const { ref: at, saved } = current;
    const body = cohortChanges(saved, values);
    if (Object.keys(body).length === 0) {
      await closeProgramDialog();
      toast.show(m.value.programs.noChange);
      return;
    }
    const result = await programWrites.send(
      () => updateCohort(at, body),
      async () => cohortMatches(await fetchCohort(at), values),
    );
    // The curriculum's names are on screen: show the saved ones.
    if (result.outcome === 'saved' || result.outcome === 'confirmed') await showSaved();
    await finishProgram(result, m.value.programs.cohortSaved(saved.cohortYear));
    return;
  }
  if (current?.type !== 'add-cohort') return;
  const { programId } = current;
  let created: string | null = null;
  const result = await programWrites.send(
    () => createCohort(programId, newCohortBody(values)),
    async () => {
      const { cohorts } = await fetchCohorts(programId);
      created = cohorts.find((item) => cohortMatches(item, values, true))?.id ?? null;
      return created !== null;
    },
  );
  if (result.outcome === 'saved') created = result.value.id;
  // The new cohort is opened: it has no group yet.
  await finishProgram(result, m.value.programs.cohortCreated(values.cohortYear.trim()), () => {
    if (created) picked.value = { programId, curriculumId: created };
  });
}

/** "Reload the data" after an unknown outcome: the same write is settled from the saved data, not sent again. */
async function recheckProgram(): Promise<void> {
  const result = await programWrites.recheck();
  if (result?.outcome === 'confirmed') await finishProgram(result, '');
}

const programProblem = computed<ProblemView<(typeof PROGRAM_FIELDS)[number]> | null>(() => {
  if (programDialog.value?.type !== 'program' || !programWrites.problem.value) return null;
  return describeProblem(programWrites.problem.value, m.value, PROGRAM_FIELDS);
});
const cohortProblem = computed<ProblemView<(typeof COHORT_FIELDS)[number]> | null>(() => {
  if (!programDialog.value || programDialog.value.type === 'program' || !programWrites.problem.value) return null;
  const problem = describeProblem(programWrites.problem.value, m.value, COHORT_FIELDS);
  // A curriculum has this code, not a catalog course.
  return problem.code === 'duplicate_code' ? { ...problem, text: m.value.programs.duplicateCohortCode } : problem;
});

// ---------- What a write that is not known to be saved says ----------
const groupProblem = computed(() => (dialog.value?.type === 'group' && dialogWrites.problem.value ? describeProblem(dialogWrites.problem.value, m.value, GROUP_FIELDS) : null));
const prerequisitesProblem = computed(() =>
  dialog.value?.type === 'prerequisites' && dialogWrites.problem.value ? describeProblem(dialogWrites.problem.value, m.value, PREREQUISITE_FIELDS) : null,
);
const termsProblem = computed(() => (dialog.value?.type === 'terms' && dialogWrites.problem.value ? describeProblem(dialogWrites.problem.value, m.value, TERM_FIELDS) : null));
const confirmProblem = computed(() =>
  (dialog.value?.type === 'delete-group' || dialog.value?.type === 'unlink') && dialogWrites.problem.value ? describeProblem(dialogWrites.problem.value, m.value) : null,
);
const linkProblem = computed(() => {
  if (!linkWrites.problem.value) return null;
  const problem = describeProblem(linkWrites.problem.value, m.value, LINK_FIELDS);
  // A 404 here is the catalog not having the code (or the group being gone): say that, not "this item".
  return problem.code === 'not_found' ? { ...problem, text: text.value.linkNotFound } : problem;
});
const confirmText = computed(() => {
  const current = dialog.value;
  if (current?.type === 'delete-group') return { title: text.value.deleteGroupTitle, body: text.value.deleteGroupBody(current.group.name), confirm: text.value.delete };
  if (current?.type === 'unlink') return { title: text.value.unlinkTitle(current.course.code), body: text.value.unlinkBody(current.course.code, current.group.name), confirm: text.value.unlink };
  return { title: '', body: '', confirm: '' };
});

function pickProgram(programId: string): void {
  picked.value = { programId, curriculumId: null };
}
function pickCohort(curriculumId: string): void {
  if (program.value) picked.value = { programId: program.value.id, curriculumId };
}
watch(
  () => cohort.value?.id,
  () => {
    openId.value = null;
    linkCode.value = '';
    notice.value = null;
    late.value = null;
    linkWrites.clear();
    expanded.value = new Set();
    void load();
  },
  { immediate: true },
);
watch(openId, () => {
  linkCode.value = '';
  dropLinkProblem();
});

const prerequisiteState = (course: CurriculumCourse) => (course.prerequisites === null ? 'not-recorded' : course.prerequisites.length === 0 ? 'none' : 'recorded');
</script>

<template>
  <section class="admin-section" aria-labelledby="curriculum-admin-title">
    <h2 id="curriculum-admin-title" class="sr-only">{{ text.heading }}</h2>

    <p v-if="programsStatus === 'loading'" class="t3" role="status">{{ m.loading }}</p>
    <p v-else-if="programsStatus === 'failed'" class="callout bad" role="alert" data-test="programs-failed">
      <Icon name="alert" /><span>{{ text.programsFailed }} <button class="btn sm" type="button" @click="loadPrograms()">{{ m.retry }}</button></span>
    </p>
    <p v-else-if="!program" class="callout" role="status" data-test="no-programs"><Icon name="info" /><span>{{ text.noPrograms }}</span></p>
    <template v-else>
      <div class="admin-banner">
        <label class="field">
          <span>{{ text.program }}</span>
          <SelectMenu :model-value="program.id" :options="(programList ?? []).map((item) => ({ value: item.id, label: `${item.code} · ${item.nameVi}` }))" data-test="admin-program" @update:model-value="pickProgram" />
        </label>
        <label v-if="program.curricula.length" class="field">
          <span>{{ text.cohort }}</span>
          <SelectMenu :model-value="cohort?.id" :options="program.curricula.map((item) => ({ value: item.id, label: text.cohortOption(item.cohortYear) }))" data-test="admin-cohort" @update:model-value="pickCohort" />
        </label>
        <div v-if="curriculum" class="grow small" data-test="curriculum-summary">
          <b>{{ (locale.lang === 'en' && curriculum.nameEn) || curriculum.nameVi }} · {{ curriculum.code }}</b><br />{{ text.thisCohortOnly }}
        </div>
        <div class="banner-acts">
          <button id="program-edit" class="btn sm" type="button" :disabled="opening || programBusy" :aria-label="m.programs.editProgramLabel(program.code)" data-test="program-edit" @click="editProgram">
            <Icon name="edit" size="sm" />{{ m.programs.editProgram }}
          </button>
          <button v-if="cohort" id="cohort-edit" class="btn sm" type="button" :disabled="opening || programBusy" :aria-label="m.programs.editCohortLabel(cohort.cohortYear)" data-test="cohort-edit" @click="editCohort">
            <Icon name="edit" size="sm" />{{ m.programs.editCohort }}
          </button>
          <button id="cohort-add" class="btn sm" type="button" :disabled="opening || programBusy" data-test="cohort-add" @click="addCohort"><Icon name="plus" size="sm" />{{ m.programs.addCohort }}</button>
        </div>
      </div>
      <p v-if="detailsFailed" class="callout bad" role="alert" data-test="details-failed"><Icon name="alert" /><span>{{ detailsFailed }}</span></p>

      <!-- The outcome of a link sent for a cohort the administrator has since left, with that cohort's name. -->
      <div v-if="late" class="callout admin-late" :class="late.tone" :role="late.tone === 'ok' ? 'status' : 'alert'" data-test="admin-late">
        <Icon :name="late.tone === 'ok' ? 'check' : 'alert'" />
        <div>
          <p>{{ late.text }}</p>
          <ul v-if="late.items.length">
            <li v-for="item in late.items" :key="item">{{ item }}</li>
          </ul>
        </div>
      </div>

      <p v-if="notice && !curriculum" class="callout ok" role="status" data-test="admin-notice"><Icon name="check" /><span>{{ notice }}</span></p>
      <p v-if="!cohort" class="callout" role="status" data-test="no-cohorts"><Icon name="info" /><span>{{ text.noCohorts }}</span></p>
      <p v-else-if="status === 'loading'" class="t3" role="status">{{ m.loading }}</p>
      <p v-else-if="status === 'missing'" class="callout" role="status" data-test="no-curriculum"><Icon name="info" /><span>{{ text.noCurriculum }}</span></p>
      <p v-else-if="status === 'failed'" class="callout bad" role="alert" data-test="curriculum-failed">
        <Icon name="alert" /><span>{{ text.loadFailed }} <button class="btn sm" type="button" @click="load">{{ m.retry }}</button></span>
      </p>
      <template v-else-if="curriculum">
        <p v-if="notice" class="callout ok" role="status" data-test="admin-notice"><Icon name="check" /><span>{{ notice }}</span></p>
        <p v-if="stale" class="callout warn" role="alert" data-test="curriculum-stale">
          <Icon name="alert" /><span>{{ m.stale }} <button id="curriculum-reload" class="btn sm" type="button" data-test="curriculum-reload" @click="showSaved">{{ m.reload }}</button></span>
        </p>

        <section class="card flush" aria-labelledby="groups-title">
          <div class="card-head">
            <h3 id="groups-title" data-test="groups-title">{{ text.groupsTitle(groups.length) }}</h3>
            <div class="head-acts">
              <RouterLink
                v-if="scope"
                class="btn sm"
                :to="{ name: 'admin-import', query: { type: 'group_links', program: scope.ref.programId, cohort: scope.ref.curriculumId } }"
                data-test="open-import"
                >{{ text.importLink }}</RouterLink
              >
              <button id="add-group" class="btn sm" type="button" :disabled="stale" data-test="add-group" @click="open({ type: 'group', group: null }, $event)"><Icon name="plus" size="sm" />{{ text.addGroup }}</button>
            </div>
          </div>
          <p class="admin-note small t3">{{ text.totalsReadOnly }}</p>
          <p v-if="groups.length === 0" class="admin-empty t2" data-test="no-groups">{{ text.noGroups }}</p>
          <div v-else class="table-wrap">
            <!-- On a narrow screen each row is a card (the styles below): every value with its name, the actions in view. -->
            <table class="table admin-cards admin-groups">
              <thead>
                <tr>
                  <th scope="col">{{ text.columns.group }}</th>
                  <th scope="col">{{ text.columns.kind }}</th>
                  <th scope="col">{{ text.columns.credits }}</th>
                  <th scope="col" class="r">{{ text.columns.courses }}</th>
                  <th scope="col"><span class="sr-only">{{ text.columns.actions }}</span></th>
                </tr>
              </thead>
              <tbody>
                <template v-for="group in groups" :key="group.id">
                  <tr :class="[groupClass(colour(group)), { on: group.id === openId, noted: group.officialNotes }]" data-test="group-row" :data-group-id="group.id" :data-group-name="group.name">
                    <th scope="row">
                      <span class="group-name"><span class="glyph sm" aria-hidden="true">{{ glyph(group) }}</span>{{ group.name }}</span>
                    </th>
                    <td data-test="group-kind" :data-label="text.columns.kind">{{ text.kinds[group.kind] }}</td>
                    <td data-test="group-credits" :data-label="text.columns.credits">{{ credits(group) }}</td>
                    <td class="r" :data-label="text.columns.courses">{{ group.courses.length }}</td>
                    <td class="r acts">
                      <div class="row-acts">
                        <button class="btn sm" type="button" :aria-expanded="group.id === openId" aria-controls="group-panel" :aria-label="text.openLabel(group.name)" data-test="group-open" @click="openId = group.id">
                          {{ group.id === openId ? text.opened : text.open }}
                        </button>
                        <button class="btn sm" type="button" :disabled="stale" :aria-label="text.editGroupLabel(group.name)" data-test="group-edit" @click="open({ type: 'group', group }, $event)">
                          <Icon name="edit" size="sm" />{{ text.edit }}
                        </button>
                        <button class="btn sm" type="button" :disabled="stale" :aria-label="text.deleteGroupLabel(group.name)" data-test="group-delete" @click="open({ type: 'delete-group', group }, $event)">
                          <Icon name="trash" size="sm" />{{ text.delete }}
                        </button>
                      </div>
                    </td>
                  </tr>
                  <!-- The printed rule, on its own line under the row. All of a long one is a button away, never cut for good. -->
                  <tr v-if="group.officialNotes" :class="['group-note', groupClass(colour(group)), { on: group.id === openId }]" data-test="group-note-row" :data-group-id="group.id">
                    <td colspan="5">
                      <div class="note">
                        <span class="note-label">{{ text.columns.notes }}</span>
                        <span :id="`group-note-${group.id}`" class="note-text" :class="{ clamped: isLong(group.officialNotes) && !expanded.has(group.id) }" data-test="group-note">{{ group.officialNotes }}</span>
                        <button
                          v-if="isLong(group.officialNotes)"
                          class="link small"
                          type="button"
                          :aria-expanded="expanded.has(group.id)"
                          :aria-controls="`group-note-${group.id}`"
                          :aria-label="expanded.has(group.id) ? text.noteLessLabel(group.name) : text.noteMoreLabel(group.name)"
                          data-test="group-note-toggle"
                          @click="toggleNote(group.id)"
                        >
                          {{ expanded.has(group.id) ? text.showLess : text.showMore }}
                        </button>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <div v-if="openGroup" id="group-panel" :class="['group-panel', groupClass(colour(openGroup))]" role="region" aria-labelledby="group-panel-title" data-test="group-panel" :data-group-id="openGroup.id">
            <h3 id="group-panel-title">{{ text.coursesIn(openGroup.name, openGroup.courses.length) }}</h3>
            <form class="link-form" novalidate @submit.prevent="link">
              <div class="field">
                <label for="link-code">{{ text.linkLabel }}</label>
                <input
                  id="link-code"
                  v-model="linkCode"
                  class="input mono"
                  autocomplete="off"
                  spellcheck="false"
                  data-test="link-code"
                  :aria-invalid="linkProblem?.fields.courseCode ? 'true' : undefined"
                  :aria-describedby="linkProblem?.fields.courseCode ? 'link-hint link-error' : 'link-hint'"
                  @input="dropLinkProblem"
                />
              </div>
              <button class="btn" type="submit" :disabled="!linkCode.trim() || linkWrites.busy.value || stale" data-test="link-submit"><Icon name="plus" size="sm" />{{ text.linkSubmit }}</button>
            </form>
            <p id="link-hint" class="hint">{{ text.linkHint }}</p>
            <FieldErrors id="link-error" :errors="linkProblem?.fields.courseCode" />
            <ProblemNote :problem="linkProblem" @reload="recheckLink" />

            <p v-if="openGroup.courses.length === 0" class="t2" data-test="no-courses">{{ text.noCourses }}</p>
            <div v-else class="table-wrap">
              <table class="table admin-cards admin-courses">
                <thead>
                  <tr>
                    <th scope="col">{{ text.courseColumns.code }}</th>
                    <th scope="col">{{ text.courseColumns.name }}</th>
                    <th scope="col" class="r">{{ text.courseColumns.credits }}</th>
                    <th scope="col">{{ text.courseColumns.prerequisites }}</th>
                    <th scope="col">{{ text.courseColumns.terms }}</th>
                    <th scope="col"><span class="sr-only">{{ text.courseColumns.actions }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="course in openGroup.courses" :key="course.code" data-test="course-row" :data-course="course.code">
                    <th scope="row"><span class="code c">{{ course.code }}</span></th>
                    <td class="name">{{ courseName(course, locale.lang) }}</td>
                    <td class="r" :data-label="text.courseColumns.credits">{{ course.credits }}</td>
                    <!-- Not recorded (unknown) and none (recorded) are different facts: each in its own words, never by colour alone. -->
                    <td data-test="prerequisites" :data-state="prerequisiteState(course)" :data-label="text.courseColumns.prerequisites">
                      <div class="rule">
                        <span v-if="course.prerequisites === null" class="chip warn"><Icon name="info" size="sm" />{{ m.notRecorded }}</span>
                        <span v-else-if="course.prerequisites.length === 0" class="chip ok"><Icon name="check" size="sm" />{{ text.noPrerequisite }}</span>
                        <span v-else class="codes"><span v-for="code in course.prerequisites" :key="code" class="code">{{ code }}</span></span>
                        <button
                          class="btn sm ghost icon-only"
                          type="button"
                          :disabled="stale"
                          :aria-label="text.editPrerequisitesLabel(course.code)"
                          :title="text.editPrerequisitesLabel(course.code)"
                          data-test="edit-prerequisites"
                          @click="open({ type: 'prerequisites', course }, $event)"
                        >
                          <Icon name="edit" size="sm" />
                        </button>
                      </div>
                    </td>
                    <td data-test="offering-terms" :data-state="course.offeringTerms === null ? 'not-recorded' : 'recorded'" :data-label="text.courseColumns.terms">
                      <div class="rule">
                        <span v-if="course.offeringTerms === null" class="chip warn"><Icon name="info" size="sm" />{{ m.notRecorded }}</span>
                        <span v-else>{{ course.offeringTerms.map((term) => text.term(term)).join(', ') }}</span>
                        <button
                          class="btn sm ghost icon-only"
                          type="button"
                          :disabled="stale"
                          :aria-label="text.editTermsLabel(course.code)"
                          :title="text.editTermsLabel(course.code)"
                          data-test="edit-terms"
                          @click="open({ type: 'terms', course }, $event)"
                        >
                          <Icon name="edit" size="sm" />
                        </button>
                      </div>
                    </td>
                    <td class="r acts">
                      <button
                        class="btn sm ghost icon-only"
                        type="button"
                        :disabled="stale"
                        :aria-label="text.unlinkLabel(course.code)"
                        :title="text.unlinkLabel(course.code)"
                        data-test="unlink-course"
                        @click="open({ type: 'unlink', group: openGroup, course }, $event)"
                      >
                        <Icon name="trash" size="sm" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </template>
    </template>

    <GroupDialog :open="dialog?.type === 'group'" :group="dialog?.type === 'group' ? dialog.group : null" :busy="busy" :problem="groupProblem" @close="cancel" @save="saveGroup" @reload="recheckDialog" />
    <PrerequisitesDialog
      :open="dialog?.type === 'prerequisites'"
      :course="dialog?.type === 'prerequisites' ? dialog.course : null"
      :busy="busy"
      :problem="prerequisitesProblem"
      @close="cancel"
      @save="savePrerequisites"
      @reload="recheckDialog"
    />
    <ProgramDialog
      :open="programDialog?.type === 'program'"
      :program="programDialog?.type === 'program' ? programDialog.saved : null"
      :busy="programBusy"
      :problem="programProblem"
      @close="cancelProgramDialog"
      @save="saveProgramDetails"
      @reload="recheckProgram"
    />
    <CohortDialog
      :open="programDialog?.type === 'add-cohort' || programDialog?.type === 'edit-cohort'"
      :program-code="programDialog && programDialog.type !== 'program' ? programDialog.programCode : ''"
      :cohort="programDialog?.type === 'edit-cohort' ? programDialog.saved : null"
      :busy="programBusy"
      :problem="cohortProblem"
      @close="cancelProgramDialog"
      @save="saveCohort"
      @reload="recheckProgram"
    />
    <OfferingTermsDialog :open="dialog?.type === 'terms'" :course="dialog?.type === 'terms' ? dialog.course : null" :busy="busy" :problem="termsProblem" @close="cancel" @save="saveTerms" @reload="recheckDialog" />
    <ConfirmDialog
      :open="dialog?.type === 'delete-group' || dialog?.type === 'unlink'"
      :title="confirmText.title"
      :body="confirmText.body"
      :confirm="confirmText.confirm"
      :busy="busy"
      :problem="confirmProblem"
      @close="cancel"
      @confirm="dialog?.type === 'unlink' ? unlink() : removeGroup()"
      @reload="recheckDialog"
    />
  </section>
</template>

<style>
/* The admin prototype (ui-prototypes/admin.html): the program and cohort banner, the groups table, one open group. */
.admin-banner { display: flex; align-items: center; gap: 14px; padding: 14px 18px; background: color-mix(in oklab, var(--hi) 55%, var(--surface)); border-radius: 16px; border: 1px solid var(--edge); flex-wrap: wrap; }
.admin-banner .field { min-width: 180px; }
.admin-banner .grow { flex: 1; min-width: 200px; }
.admin-banner .banner-acts { display: flex; flex-wrap: wrap; gap: 6px; }
.admin-section .card-head .head-acts { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
:root[data-theme='dark'] .admin-banner { border-color: color-mix(in oklab, var(--info) 30%, var(--edge)); }
.admin-late > div { display: grid; gap: 4px; min-width: 0; }
.admin-late ul { margin: 0; padding-left: 18px; font-size: 14px; }
.admin-note { padding: 0 22px 8px; }
.admin-empty { padding: 24px 22px; }
.admin-groups tr.on > * { background: var(--c-air); }
.admin-groups .group-name { display: flex; gap: 10px; align-items: center; min-width: 160px; }
/* A row and the line of its printed rule read as one: no rule between them. */
.admin-section .admin-groups tr.noted > * { border-bottom: 0; padding-bottom: 6px; }
.admin-groups tr.group-note > td { padding-top: 0; }
.admin-groups .note { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; font-size: 13px; color: var(--ink-2); padding-left: 36px; }
.admin-groups .note-label { font-size: 12px; font-weight: 650; color: var(--ink-3); }
.admin-groups .note-text { flex: 1 1 320px; min-width: 0; white-space: pre-line; overflow-wrap: anywhere; }
.admin-groups .note-text.clamped { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
.group-panel { border-top: 2px solid var(--edge); padding: 18px 22px 22px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; background: var(--c-soft); border-radius: 0 0 var(--r) var(--r); }
.group-panel .table-wrap { background: var(--surface); border: 1px solid var(--edge); border-radius: 12px; }
.admin-courses td.name { min-width: 180px; overflow-wrap: anywhere; }
.admin-courses .rule { display: flex; align-items: center; gap: 6px; }
.admin-courses .codes { display: flex; flex-wrap: wrap; gap: 4px; }
@media (max-width: 620px) {
  .admin-note { padding: 0 16px 8px; }
  .group-panel { padding: 16px; }
}
/* Narrow: each row is a card (the shared rules are in AdminView.vue). */
@media (max-width: 760px) {
  .admin-groups tr.on { background: var(--c-air); }
  .admin-groups tr.noted { padding-bottom: 6px; }
  .admin-groups tr.group-note { display: block; border-top: 0; padding-top: 0; }
  .admin-groups .note { padding-left: 0; }
  .admin-groups .group-name { min-width: 0; }
  /* A course: its code and the button that removes it on the first line, then its name and each rule with its name. */
  .admin-courses tr { grid-template-columns: minmax(0, 1fr) auto; }
  .admin-courses th[scope='row'] { grid-column: 1; grid-row: 1; align-self: center; }
  .admin-courses td.acts { grid-column: 2; grid-row: 1; }
  .admin-courses td.name, .admin-courses td[data-label] { grid-column: 1 / -1; }
  .admin-courses td.name { font-weight: 650; min-width: 0; }
}
</style>
