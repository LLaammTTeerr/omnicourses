<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import { useAsyncLoad } from '../async-load.js';
import { useAuth } from '../auth/store.js';
import SelectMenu from '../components/SelectMenu.vue';
import { fetchCurriculum, type Curriculum, type CurriculumCourse, type RequirementGroup } from '../curriculum/api.js';
import { courseName, groupColour } from '../curriculum/present.js';
import { GROUPS, groupClass } from '../groups.js';
import { useLocale, useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { useToast } from '../shell/toast.js';
import {
  clearOfferingTerms,
  clearPrerequisites,
  createGroup,
  deleteGroup,
  fetchAdminPrograms,
  linkCourse,
  setOfferingTerms,
  setPrerequisites,
  unlinkCourse,
  updateGroup,
  type CohortRef,
} from './api.js';
import ConfirmDialog from './ConfirmDialog.vue';
import { readFailure } from './errors.js';
import FieldErrors from './FieldErrors.vue';
import {
  courseIn,
  GROUP_FIELDS,
  groupChanges,
  groupHas,
  groupMatches,
  LINK_FIELDS,
  newGroupBody,
  PREREQUISITE_FIELDS,
  sameList,
  storedCode,
  storedPrerequisites,
  TERM_FIELDS,
  type GroupValues,
  type PrerequisiteChoice,
} from './forms.js';
import GroupDialog from './GroupDialog.vue';
import { ADMIN_MESSAGES } from './messages.js';
import OfferingTermsDialog from './OfferingTermsDialog.vue';
import PrerequisitesDialog from './PrerequisitesDialog.vue';
import { describeProblem } from './problem.js';
import ProblemNote from './ProblemNote.vue';
import { useWrites, type WriteOutcome } from './write.js';

// The curriculum editor of a program administrator (ADR 0011, UC-11 basic flow; UI prototypes: admin.html, "Nhóm
// yêu cầu"): the requirement groups of one granted program and cohort, the courses each links, and each course's
// prerequisites and offering terms in that cohort. Every check is the API's: the page sends what was entered and
// shows what the API answers, and it computes no academic rule (AGENTS.md hard rule 1). The prototype's "Add
// cohort", version line and credit-total editing have no route, so they are not here.
const auth = useAuth();
const locale = useLocale();
const toast = useToast();
const m = useMessages(ADMIN_MESSAGES);
const text = computed(() => m.value.curriculum);

// ---------- Program and cohort: only the ones the API lists for this user ----------
const programs = useAsyncLoad('the programs to administer', async () => (await auth.authed(fetchAdminPrograms)).programs);
const picked = ref<{ programId: string; curriculumId: string | null } | null>(null);
const program = computed(() => {
  const list = programs.data.value ?? [];
  return list.find((item) => item.id === picked.value?.programId) ?? list[0] ?? null;
});
const cohort = computed(() => program.value?.curricula.find((item) => item.id === picked.value?.curriculumId) ?? program.value?.curricula[0] ?? null);
const target = computed<CohortRef | null>(() => (program.value && cohort.value ? { programId: program.value.id, curriculumId: cohort.value.id } : null));

// ---------- The saved curriculum ----------
const curriculum = shallowRef<Curriculum | null>(null);
const status = ref<'loading' | 'loaded' | 'failed' | 'missing'>('loading');
/** A reload after a write failed: what is on screen may be older than what is saved. */
const stale = ref(false);
let latest = 0;

/** Loads the saved curriculum again and keeps the page as it is meanwhile, so the focus and the open group stay. Rejects when it cannot. */
async function refresh(): Promise<Curriculum> {
  const call = ++latest;
  const [of, at] = [program.value!, cohort.value!];
  const fresh = await auth.authed((token) => fetchCurriculum(token, of.code, at.cohortYear));
  if (call === latest) {
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
  if (!cohort.value) return;
  const call = latest + 1;
  try {
    await refresh();
  } catch (e) {
    if (call !== latest) return;
    const failure = readFailure(e);
    if (failure.kind === 'signed_out') return;
    if (failure.kind !== 'not_found') console.error('Loading the curriculum to administer failed:', e);
    status.value = failure.kind === 'not_found' ? 'missing' : 'failed';
  }
}

/** After a write the API confirmed: show the saved values; a failed reload is said, not hidden. */
async function showSaved(): Promise<void> {
  try {
    await refresh();
  } catch (e) {
    if (readFailure(e).kind === 'signed_out') return;
    console.error('Reloading the curriculum after a save failed:', e);
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

// ---------- Writes ----------
type Dialog =
  | { type: 'group'; group: RequirementGroup | null }
  | { type: 'delete-group'; group: RequirementGroup }
  | { type: 'unlink'; group: RequirementGroup; course: CurriculumCourse }
  | { type: 'prerequisites'; course: CurriculumCourse }
  | { type: 'terms'; course: CurriculumCourse };
const dialog = shallowRef<Dialog | null>(null);
const dialogWrites = useWrites();
const linkWrites = useWrites();
/** A write is answered and the saved data is being shown: the dialog stays busy until then. */
const settling = ref(false);
const busy = computed(() => dialogWrites.busy.value || settling.value);
/** A lost answer that the reloaded data settled: said on the page, since the dialog has closed. */
const notice = ref<string | null>(null);
let opener: HTMLElement | null = null;

/** `from`: the click that asked for it. Its button gets the focus back; not every browser focuses a button on a click. */
function open(next: Dialog, from: Event): void {
  opener = from.currentTarget instanceof HTMLElement ? from.currentTarget : null;
  dialogWrites.clear();
  notice.value = null;
  dialog.value = next;
}

/** Closes the dialog and puts the focus back where it was, or on `fallback` when that control is gone. */
async function close(fallback = 'add-group'): Promise<void> {
  dialog.value = null;
  dialogWrites.clear();
  await nextTick();
  (opener?.isConnected ? opener : document.getElementById(fallback))?.focus();
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

async function saveGroup(entered: GroupValues): Promise<void> {
  const [at, current] = [target.value, dialog.value];
  if (!at || current?.type !== 'group') return;
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
      (token) => updateGroup(token, at, id, body),
      async () => {
        const saved = (await refresh()).requirementGroups.find((group) => group.id === id);
        return saved !== undefined && groupMatches(saved, entered);
      },
    );
    await finish(result, text.value.groupSaved(name));
    return;
  }
  const existed = groups.value.some((group) => group.name === name);
  const result = await dialogWrites.send(
    (token) => createGroup(token, at, newGroupBody(entered)),
    // A group of this name that was there before is not this write: the API refuses a second one.
    async () => !existed && (await refresh()).requirementGroups.some((group) => groupMatches(group, entered)),
  );
  if (await finish(result, text.value.groupCreated(name))) {
    const created = result.outcome === 'saved' ? result.value.id : groups.value.find((group) => group.name === name)?.id;
    if (created) openId.value = created;
  }
}

async function removeGroup(): Promise<void> {
  const [at, current] = [target.value, dialog.value];
  if (!at || current?.type !== 'delete-group') return;
  const { id, name } = current.group;
  const result = await dialogWrites.send(
    (token) => deleteGroup(token, at, id),
    async () => !(await refresh()).requirementGroups.some((group) => group.id === id),
  );
  await finish(result, text.value.groupDeleted(name));
}

const linkCode = ref('');
async function link(): Promise<void> {
  const [at, group, typed] = [target.value, openGroup.value, linkCode.value];
  if (!at || !group || !typed.trim() || linkWrites.busy.value) return;
  notice.value = null;
  const code = storedCode(typed);
  const result = await linkWrites.send(
    (token) => linkCourse(token, at, group.id, typed),
    async () => groupHas(await refresh(), group.id, code),
  );
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
  const [at, current] = [target.value, dialog.value];
  if (!at || current?.type !== 'unlink') return;
  const { group, course } = current;
  const result = await dialogWrites.send(
    (token) => unlinkCourse(token, at, group.id, course.code),
    async () => !groupHas(await refresh(), group.id, course.code),
  );
  await finish(result, text.value.unlinked(course.code), 'link-code');
}

async function savePrerequisites(choice: PrerequisiteChoice): Promise<void> {
  const [at, current] = [target.value, dialog.value];
  if (!at || current?.type !== 'prerequisites') return;
  const { code } = current.course;
  const want = storedPrerequisites(choice);
  const result = await dialogWrites.send(
    (token) => (choice.state === 'not_recorded' ? clearPrerequisites(token, at, code) : setPrerequisites(token, at, code, choice.state === 'none' ? [] : choice.codes)),
    async () => {
      const saved = courseIn(await refresh(), code);
      return saved !== null && sameList(saved.prerequisites, want);
    },
  );
  await finish(result, choice.state === 'not_recorded' ? text.value.prerequisitesCleared(code) : text.value.prerequisitesSaved(code));
}

/** No term: back to not recorded, since an offering list is never empty. */
async function saveTerms(terms: number[]): Promise<void> {
  const [at, current] = [target.value, dialog.value];
  if (!at || current?.type !== 'terms') return;
  const { code } = current.course;
  const want = terms.length ? [...terms].sort((a, b) => a - b) : null;
  const result = await dialogWrites.send(
    (token) => (terms.length ? setOfferingTerms(token, at, code, terms) : clearOfferingTerms(token, at, code)),
    async () => {
      const saved = courseIn(await refresh(), code);
      return saved !== null && sameList(saved.offeringTerms, want);
    },
  );
  await finish(result, terms.length ? text.value.termsSaved(code) : text.value.termsCleared(code));
}

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
    linkWrites.clear();
    void load();
  },
  { immediate: true },
);
watch(openId, () => {
  linkCode.value = '';
  linkWrites.clear();
});

const prerequisiteState = (course: CurriculumCourse) => (course.prerequisites === null ? 'not-recorded' : course.prerequisites.length === 0 ? 'none' : 'recorded');
</script>

<template>
  <section class="admin-section" aria-labelledby="curriculum-admin-title">
    <h2 id="curriculum-admin-title" class="sr-only">{{ text.heading }}</h2>

    <p v-if="programs.status.value === 'loading'" class="t3" role="status">{{ m.loading }}</p>
    <p v-else-if="programs.status.value === 'failed'" class="callout bad" role="alert" data-test="programs-failed">
      <Icon name="alert" /><span>{{ text.programsFailed }} <button class="btn sm" type="button" @click="programs.reload">{{ m.retry }}</button></span>
    </p>
    <p v-else-if="!program" class="callout" role="status" data-test="no-programs"><Icon name="info" /><span>{{ text.noPrograms }}</span></p>
    <template v-else>
      <div class="admin-banner">
        <label class="field">
          <span>{{ text.program }}</span>
          <SelectMenu :model-value="program.id" :options="(programs.data.value ?? []).map((item) => ({ value: item.id, label: `${item.code} · ${item.nameVi}` }))" data-test="admin-program" @update:model-value="pickProgram" />
        </label>
        <label v-if="program.curricula.length" class="field">
          <span>{{ text.cohort }}</span>
          <SelectMenu :model-value="cohort?.id" :options="program.curricula.map((item) => ({ value: item.id, label: text.cohortOption(item.cohortYear) }))" data-test="admin-cohort" @update:model-value="pickCohort" />
        </label>
        <div v-if="curriculum" class="grow small" data-test="curriculum-summary">
          <b>{{ (locale.lang === 'en' && curriculum.nameEn) || curriculum.nameVi }} · {{ curriculum.code }}</b><br />{{ text.thisCohortOnly }}
        </div>
      </div>

      <p v-if="!cohort" class="callout" role="status" data-test="no-cohorts"><Icon name="info" /><span>{{ text.noCohorts }}</span></p>
      <p v-else-if="status === 'loading'" class="t3" role="status">{{ m.loading }}</p>
      <p v-else-if="status === 'missing'" class="callout" role="status" data-test="no-curriculum"><Icon name="info" /><span>{{ text.noCurriculum }}</span></p>
      <p v-else-if="status === 'failed'" class="callout bad" role="alert" data-test="curriculum-failed">
        <Icon name="alert" /><span>{{ text.loadFailed }} <button class="btn sm" type="button" @click="load">{{ m.retry }}</button></span>
      </p>
      <template v-else-if="curriculum">
        <p v-if="notice" class="callout ok" role="status" data-test="admin-notice"><Icon name="check" /><span>{{ notice }}</span></p>
        <p v-if="stale" class="callout warn" role="alert" data-test="curriculum-stale">
          <Icon name="alert" /><span>{{ text.stale }} <button class="btn sm" type="button" data-test="curriculum-reload" @click="showSaved">{{ m.reload }}</button></span>
        </p>

        <section class="card flush" aria-labelledby="groups-title">
          <div class="card-head">
            <h3 id="groups-title" data-test="groups-title">{{ text.groupsTitle(groups.length) }}</h3>
            <button id="add-group" class="btn sm" type="button" data-test="add-group" @click="open({ type: 'group', group: null }, $event)"><Icon name="plus" size="sm" />{{ text.addGroup }}</button>
          </div>
          <p class="admin-note small t3">{{ text.totalsReadOnly }}</p>
          <p v-if="groups.length === 0" class="admin-empty t2" data-test="no-groups">{{ text.noGroups }}</p>
          <div v-else class="table-wrap">
            <table class="table admin-groups">
              <thead>
                <tr>
                  <th scope="col">{{ text.columns.group }}</th>
                  <th scope="col">{{ text.columns.kind }}</th>
                  <th scope="col">{{ text.columns.credits }}</th>
                  <th scope="col">{{ text.columns.notes }}</th>
                  <th scope="col" class="r">{{ text.columns.courses }}</th>
                  <th scope="col"><span class="sr-only">{{ text.columns.actions }}</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="group in groups" :key="group.id" :class="[groupClass(colour(group)), { on: group.id === openId }]" data-test="group-row" :data-group-id="group.id" :data-group-name="group.name">
                  <th scope="row">
                    <span class="group-name"><span class="glyph sm" aria-hidden="true">{{ glyph(group) }}</span>{{ group.name }}</span>
                  </th>
                  <td data-test="group-kind">{{ text.kinds[group.kind] }}</td>
                  <td data-test="group-credits">{{ credits(group) }}</td>
                  <td class="small t2 notes">{{ group.officialNotes }}</td>
                  <td class="r">{{ group.courses.length }}</td>
                  <td class="r">
                    <div class="row-acts">
                    <button class="btn sm" type="button" :aria-expanded="group.id === openId" aria-controls="group-panel" :aria-label="text.openLabel(group.name)" data-test="group-open" @click="openId = group.id">
                      {{ group.id === openId ? text.opened : text.open }}
                    </button>
                    <button class="btn sm" type="button" :aria-label="text.editGroupLabel(group.name)" data-test="group-edit" @click="open({ type: 'group', group }, $event)"><Icon name="edit" size="sm" />{{ text.edit }}</button>
                    <button class="btn sm" type="button" :aria-label="text.deleteGroupLabel(group.name)" data-test="group-delete" @click="open({ type: 'delete-group', group }, $event)"><Icon name="trash" size="sm" />{{ text.delete }}</button>
                    </div>
                  </td>
                </tr>
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
                />
              </div>
              <button class="btn" type="submit" :disabled="!linkCode.trim() || linkWrites.busy.value" data-test="link-submit"><Icon name="plus" size="sm" />{{ text.linkSubmit }}</button>
            </form>
            <p id="link-hint" class="hint">{{ text.linkHint }}</p>
            <FieldErrors id="link-error" :errors="linkProblem?.fields.courseCode" />
            <ProblemNote :problem="linkProblem" @reload="showSaved" />

            <p v-if="openGroup.courses.length === 0" class="t2" data-test="no-courses">{{ text.noCourses }}</p>
            <div v-else class="table-wrap">
              <table class="table admin-courses">
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
                    <td>{{ courseName(course, locale.lang) }}</td>
                    <td class="r">{{ course.credits }}</td>
                    <!-- Not recorded (unknown) and none (recorded) are different facts: each in its own words, never by colour alone. -->
                    <td data-test="prerequisites" :data-state="prerequisiteState(course)">
                      <div class="rule">
                        <span v-if="course.prerequisites === null" class="chip warn"><Icon name="info" size="sm" />{{ m.notRecorded }}</span>
                        <span v-else-if="course.prerequisites.length === 0" class="chip ok"><Icon name="check" size="sm" />{{ text.noPrerequisite }}</span>
                        <span v-else class="codes"><span v-for="code in course.prerequisites" :key="code" class="code">{{ code }}</span></span>
                        <button
                          class="btn sm ghost icon-only"
                          type="button"
                          :aria-label="text.editPrerequisitesLabel(course.code)"
                          :title="text.editPrerequisitesLabel(course.code)"
                          data-test="edit-prerequisites"
                          @click="open({ type: 'prerequisites', course }, $event)"
                        >
                          <Icon name="edit" size="sm" />
                        </button>
                      </div>
                    </td>
                    <td data-test="offering-terms" :data-state="course.offeringTerms === null ? 'not-recorded' : 'recorded'">
                      <div class="rule">
                        <span v-if="course.offeringTerms === null" class="chip warn"><Icon name="info" size="sm" />{{ m.notRecorded }}</span>
                        <span v-else>{{ course.offeringTerms.map((term) => text.term(term)).join(', ') }}</span>
                        <button
                          class="btn sm ghost icon-only"
                          type="button"
                          :aria-label="text.editTermsLabel(course.code)"
                          :title="text.editTermsLabel(course.code)"
                          data-test="edit-terms"
                          @click="open({ type: 'terms', course }, $event)"
                        >
                          <Icon name="edit" size="sm" />
                        </button>
                      </div>
                    </td>
                    <td class="r">
                      <button
                        class="btn sm ghost icon-only"
                        type="button"
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

    <GroupDialog :open="dialog?.type === 'group'" :group="dialog?.type === 'group' ? dialog.group : null" :busy="busy" :problem="groupProblem" @close="cancel" @save="saveGroup" @reload="showSaved" />
    <PrerequisitesDialog
      :open="dialog?.type === 'prerequisites'"
      :course="dialog?.type === 'prerequisites' ? dialog.course : null"
      :busy="busy"
      :problem="prerequisitesProblem"
      @close="cancel"
      @save="savePrerequisites"
      @reload="showSaved"
    />
    <OfferingTermsDialog :open="dialog?.type === 'terms'" :course="dialog?.type === 'terms' ? dialog.course : null" :busy="busy" :problem="termsProblem" @close="cancel" @save="saveTerms" @reload="showSaved" />
    <ConfirmDialog
      :open="dialog?.type === 'delete-group' || dialog?.type === 'unlink'"
      :title="confirmText.title"
      :body="confirmText.body"
      :confirm="confirmText.confirm"
      :busy="busy"
      :problem="confirmProblem"
      @close="cancel"
      @confirm="dialog?.type === 'unlink' ? unlink() : removeGroup()"
      @reload="showSaved"
    />
  </section>
</template>

<style>
/* The admin prototype (ui-prototypes/admin.html): the program and cohort banner, the groups table, one open group. */
.admin-banner { display: flex; align-items: center; gap: 14px; padding: 14px 18px; background: color-mix(in oklab, var(--hi) 55%, var(--surface)); border-radius: 16px; border: 1px solid var(--edge); flex-wrap: wrap; }
.admin-banner .field { min-width: 180px; }
.admin-banner .grow { flex: 1; min-width: 200px; }
:root[data-theme='dark'] .admin-banner { border-color: color-mix(in oklab, var(--info) 30%, var(--edge)); }
.admin-note { padding: 0 22px 8px; }
.admin-empty { padding: 24px 22px; }
.admin-groups tr.on > * { background: var(--c-air); }
.admin-groups .group-name { display: flex; gap: 10px; align-items: center; min-width: 160px; }
.admin-groups .notes { max-width: 320px; white-space: pre-line; overflow-wrap: anywhere; }
.group-panel { border-top: 2px solid var(--edge); padding: 18px 22px 22px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; background: var(--c-soft); border-radius: 0 0 var(--r) var(--r); }
.group-panel .table-wrap { background: var(--surface); border: 1px solid var(--edge); border-radius: 12px; }
.admin-courses td:nth-child(2) { min-width: 180px; overflow-wrap: anywhere; }
.admin-courses .rule { display: flex; align-items: center; gap: 6px; }
.admin-courses .codes { display: flex; flex-wrap: wrap; gap: 4px; }
@media (max-width: 620px) {
  .admin-note { padding: 0 16px 8px; }
  .group-panel { padding: 16px; }
}
</style>
