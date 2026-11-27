<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { newestOnly } from '../async-load.js';
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
  fetchCohort,
  fetchCohorts,
  linkCourse,
  setOfferingTerms,
  setPrerequisites,
  unlinkCourse,
  updateCohort,
  updateGroup,
  updateProgram,
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
import { useAdminAccess, useProgramPicker } from './store.js';
import { stayWhileBusy, useAdminDialog, useWrites, type WriteOutcome } from './write.js';

const access = useAdminAccess();
const locale = useLocale();
const toast = useToast();
const m = useMessages(ADMIN_MESSAGES);
const text = computed(() => m.value.curriculum);

const { programList, programsStatus, loadPrograms, picked, program, cohort } = useProgramPicker('the programs to administer');
void loadPrograms();

interface Scope {
  ref: CohortRef;
  programCode: string;
  cohortYear: number;
}
const scope = computed<Scope | null>(() =>
  program.value && cohort.value ? { ref: { programId: program.value.id, curriculumId: cohort.value.id }, programCode: program.value.code, cohortYear: cohort.value.cohortYear } : null,
);
const onScreen = (of: Scope): boolean => scope.value?.ref.curriculumId === of.ref.curriculumId;

const grantedIds = computed(() => (access.grants?.programs ?? []).map((grant) => grant.programId).sort().join());
const listedIds = computed(() => (programList.value ?? []).map((item) => item.id).sort().join());
watch([grantedIds, () => access.refusal], () => {
  if (!access.refusal && access.grants && programsStatus.value === 'loaded' && grantedIds.value !== listedIds.value) void loadPrograms(true);
});

const curriculum = shallowRef<Curriculum | null>(null);
const status = ref<'loading' | 'loaded' | 'failed' | 'missing'>('loading');
const stale = ref(false);
const newest = newestOnly();

async function readSaved(of: Scope): Promise<Curriculum> {
  const isNewest = onScreen(of) ? newest.start() : null;
  const fresh = await fetchCurriculum(of.programCode, of.cohortYear);
  if (isNewest?.() && onScreen(of)) {
    curriculum.value = fresh;
    status.value = 'loaded';
    stale.value = false;
  }
  return fresh;
}

async function load(): Promise<void> {
  curriculum.value = null;
  stale.value = false;
  status.value = 'loading';
  const of = scope.value;
  if (!of) return;
  const isNewest = newest.upcoming();
  try {
    await readSaved(of);
  } catch (e) {
    if (!isNewest()) return;
    const failure = readFailure(e);
    if (failure.kind === 'signed_out') return;
    if (failure.kind !== 'not_found') console.error('Loading the curriculum to administer failed:', e);
    status.value = failure.kind === 'not_found' ? 'missing' : 'failed';
  }
}

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
watch(groups, (list) => {
  if (!list.some((group) => group.id === openId.value)) openId.value = list[0]?.id ?? null;
});

const colour = (group: RequirementGroup) => groupColour(group);
const glyph = (group: RequirementGroup) => GROUPS.find((item) => item.id === colour(group))!.glyph;
const credits = (group: RequirementGroup) =>
  group.creditsTotal !== null ? text.value.creditsTotal(group.creditsTotal) : group.creditsTotalMin !== null ? text.value.creditsMin(group.creditsTotalMin) : m.value.notRecorded;

const NOTE_SHOWN_WHOLE_MAX_LENGTH = 120;
const isLong = (notes: string) => notes.length > NOTE_SHOWN_WHOLE_MAX_LENGTH || notes.includes('\n');
const expanded = ref<ReadonlySet<string>>(new Set());
function toggleNote(groupId: string): void {
  const next = new Set(expanded.value);
  if (!next.delete(groupId)) next.add(groupId);
  expanded.value = next;
}

type Ask =
  | { type: 'group'; group: RequirementGroup | null }
  | { type: 'delete-group'; group: RequirementGroup }
  | { type: 'unlink'; group: RequirementGroup; course: CurriculumCourse }
  | { type: 'prerequisites'; course: CurriculumCourse }
  | { type: 'terms'; course: CurriculumCourse };
const notice = ref(false);
const asking = useAdminDialog<Ask & { at: Scope }>({
  fallback: 'add-group',
  notice,
  stale: { reloadId: 'curriculum-reload', is: () => stale.value, mark: () => (stale.value = true) },
});
const { dialog, writes: dialogWrites, busy } = asking;
const linkWrites = useWrites();
const late = shallowRef<{ tone: 'ok' | 'bad' | 'warn'; text: string; items: string[] } | null>(null);

stayWhileBusy(() => linkWrites.busy.value);

function dropLinkProblem(): void {
  if (linkWrites.problem.value?.outcome === 'unknown') stale.value = true;
  linkWrites.clear();
}

function open(next: Ask, from: Event): void {
  const at = scope.value;
  if (!at) return;
  dropLinkProblem();
  if (stale.value) return;
  notice.value = false;
  late.value = null;
  asking.open({ ...next, at }, from);
}

const close = asking.close;

const cancel = asking.cancel;

const finish = (result: WriteOutcome<unknown>, saved: string, fallback?: string): Promise<boolean> =>
  asking.finish(result, saved, { before: () => (result.outcome === 'saved' ? showSaved() : undefined), fallback });

async function recheckDialog(): Promise<void> {
  if ((await dialogWrites.recheck())?.outcome !== 'confirmed') return;
  await close();
  notice.value = true;
}
async function recheckLink(): Promise<void> {
  if ((await linkWrites.recheck())?.outcome !== 'confirmed') return;
  linkCode.value = '';
  notice.value = true;
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
  notice.value = false;
  late.value = null;
  const code = storedCode(typed);
  const result = await linkWrites.send(
    () => linkCourse(at.ref, group.id, typed),
    async () => groupHas(await readSaved(at), group.id, code),
  );
  if (!onScreen(at) || openId.value !== group.id) {
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
  } else notice.value = true;
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

type ProgramAsk =
  | { type: 'program'; programId: string; saved: SavedProgram }
  | { type: 'add-cohort'; programId: string; programCode: string }
  | { type: 'edit-cohort'; ref: CohortRef; programCode: string; saved: CohortDetails };
const programForm = useAdminDialog<ProgramAsk>({ fallback: 'cohort-add', notice });
const { dialog: programDialog, writes: programWrites, busy: programBusy } = programForm;
const detailsFailed = ref<string | null>(null);
const opening = ref(false);

async function readProgram(code: string): Promise<SavedProgram | null> {
  const { programs } = await fetchPrograms();
  return programs.find((item) => item.code === code) ?? null;
}

async function openProgramDialog(load: () => Promise<ProgramAsk | null>, from: Event, failed: string): Promise<void> {
  if (opening.value || programBusy.value) return;
  programForm.rememberOpener(from);
  detailsFailed.value = null;
  notice.value = false;
  opening.value = true;
  try {
    const next = await load();
    programWrites.clear();
    if (next) programForm.open(next);
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

const closeProgramDialog = programForm.close;
const cancelProgramDialog = programForm.cancel;

async function finishProgram(result: WriteOutcome<unknown>, saved: string, after?: () => void): Promise<void> {
  await programForm.finish(result, saved, {
    before: async () => {
      await loadPrograms(true);
      after?.();
    },
  });
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
  await finishProgram(result, m.value.programs.cohortCreated(values.cohortYear.trim()), () => {
    if (created) picked.value = { programId, curriculumId: created };
  });
}

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
  return problem.code === 'duplicate_code' ? { ...problem, text: m.value.programs.duplicateCohortCode } : problem;
});

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
    notice.value = false;
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
        <div class="field">
          <span class="label">{{ text.program }}</span>
          <SelectMenu :model-value="program.id" :aria-label="text.program" :options="(programList ?? []).map((item) => ({ value: item.id, label: `${item.code} · ${item.nameVi}` }))" data-test="admin-program" @update:model-value="pickProgram" />
        </div>
        <div v-if="program.curricula.length" class="field">
          <span class="label">{{ text.cohort }}</span>
          <SelectMenu :model-value="cohort?.id" :aria-label="text.cohort" :options="program.curricula.map((item) => ({ value: item.id, label: text.cohortOption(item.cohortYear) }))" data-test="admin-cohort" @update:model-value="pickCohort" />
        </div>
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

      <div v-if="late" class="callout admin-late" :class="late.tone" :role="late.tone === 'ok' ? 'status' : 'alert'" data-test="admin-late">
        <Icon :name="late.tone === 'ok' ? 'check' : 'alert'" />
        <div>
          <p>{{ late.text }}</p>
          <ul v-if="late.items.length">
            <li v-for="item in late.items" :key="item">{{ item }}</li>
          </ul>
        </div>
      </div>

      <p v-if="notice && !curriculum" class="callout ok" role="status" data-test="admin-notice"><Icon name="check" /><span>{{ m.problem.confirmed }}</span></p>
      <p v-if="!cohort" class="callout" role="status" data-test="no-cohorts"><Icon name="info" /><span>{{ text.noCohorts }}</span></p>
      <p v-else-if="status === 'loading'" class="t3" role="status">{{ m.loading }}</p>
      <p v-else-if="status === 'missing'" class="callout" role="status" data-test="no-curriculum"><Icon name="info" /><span>{{ text.noCurriculum }}</span></p>
      <p v-else-if="status === 'failed'" class="callout bad" role="alert" data-test="curriculum-failed">
        <Icon name="alert" /><span>{{ text.loadFailed }} <button class="btn sm" type="button" @click="load">{{ m.retry }}</button></span>
      </p>
      <template v-else-if="curriculum">
        <p v-if="notice" class="callout ok" role="status" data-test="admin-notice"><Icon name="check" /><span>{{ m.problem.confirmed }}</span></p>
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
                        <button class="btn sm" type="button" :aria-expanded="group.id === openId" :aria-controls="openGroup ? 'group-panel' : undefined" :aria-label="text.openLabel(group.name)" data-test="group-open" @click="openId = group.id">
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

<style scoped>
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
@media (max-width: 760px) {
  .admin-groups tr.on { background: var(--c-air); }
  .admin-groups tr.noted { padding-bottom: 6px; }
  .admin-groups tr.group-note { display: block; border-top: 0; padding-top: 0; }
  .admin-groups .note { padding-left: 0; }
  .admin-groups .group-name { min-width: 0; }
  .admin-cards.admin-courses tr { grid-template-columns: minmax(0, 1fr) auto; }
  .admin-cards.admin-courses th[scope='row'] { grid-column: 1; grid-row: 1; align-self: center; }
  .admin-cards.admin-courses td.acts { grid-column: 2; grid-row: 1; }
  .admin-cards.admin-courses td.name, .admin-cards.admin-courses td[data-label] { grid-column: 1 / -1; }
  .admin-cards.admin-courses td.name { font-weight: 650; min-width: 0; }
}
</style>
