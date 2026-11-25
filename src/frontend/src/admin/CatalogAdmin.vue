<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { useAuth } from '../auth/store.js';
import { fetchCourse, type Course, type CourseDetail } from '../curriculum/api.js';
import { useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { useToast } from '../shell/toast.js';
import { createCourse, deleteCourse, updateCourse } from './api.js';
import ConfirmDialog from './ConfirmDialog.vue';
import CourseDialog from './CourseDialog.vue';
import { readFailure } from './errors.js';
import { COURSE_FIELDS, courseChanges, courseHas, EDITABLE_COURSE_FIELDS, newCourseBody, storedCode, type CourseValues, type ImpactReview } from './forms.js';
import { ADMIN_MESSAGES } from './messages.js';
import { describeProblem } from './problem.js';
import { useWrites, type WriteOutcome } from './write.js';

// The shared course catalog of a catalog maintainer (ADR 0011, UC-11 A8; UI prototypes: admin.html, "Danh mục học
// phần"). The API has no route that lists or searches the catalog (ADR 0011, review finding 1), so a course is
// opened by its exact code; the prototype's table of every course is not here. A correction to a course that
// curricula link goes through the API's shared-impact review before it is saved. Every check is the API's.
const auth = useAuth();
const toast = useToast();
const m = useMessages(ADMIN_MESSAGES);
const text = computed(() => m.value.catalog);

// ---------- The course on screen, by its code ----------
const typed = ref('');
const course = shallowRef<CourseDetail | null>(null);
/** The code last looked up, as the catalog stores codes. */
const code = ref('');
const status = ref<'idle' | 'loading' | 'found' | 'missing' | 'failed'>('idle');
let latest = 0;

/** The saved course, or null when the catalog has none with this code. Rejects when the API cannot say. */
async function read(of: string): Promise<CourseDetail | null> {
  try {
    return await auth.authed((token) => fetchCourse(token, of));
  } catch (e) {
    if (readFailure(e).kind === 'not_found') return null;
    throw e;
  }
}

/** Reads `of` again and shows it, keeping the page as it is meanwhile. */
async function refresh(of = code.value): Promise<CourseDetail | null> {
  const call = ++latest;
  const fresh = await read(of);
  if (call === latest) {
    code.value = of;
    course.value = fresh;
    status.value = fresh ? 'found' : 'missing';
  }
  return fresh;
}

async function find(): Promise<void> {
  // The read route matches the stored code exactly, and the catalog stores codes trimmed and in capitals.
  const wanted = storedCode(typed.value);
  if (!wanted) return;
  notice.value = null;
  course.value = null;
  status.value = 'loading';
  const call = latest + 1;
  try {
    await refresh(wanted);
  } catch (e) {
    if (call !== latest || readFailure(e).kind === 'signed_out') return;
    console.error('Loading a catalog course failed:', e);
    code.value = wanted;
    status.value = 'failed';
  }
}

// ---------- Writes ----------
type Dialog = { type: 'create' } | { type: 'edit' } | { type: 'delete' };
const dialog = shallowRef<Dialog | null>(null);
const review = shallowRef<ImpactReview | null>(null);
const writes = useWrites();
const settling = ref(false);
const busy = computed(() => writes.busy.value || settling.value);
const notice = ref<string | null>(null);
let opener: HTMLElement | null = null;
/** The code of the course the last write was about. */
let written = '';
/**
 * A write about this course was left with its outcome unknown: what is on screen may be older than what is saved.
 * No other write starts until that course has been read again.
 */
const stale = ref<string | null>(null);

// A busy dialog refuses Escape, which leaves the Android back gesture to the browser: history back. Stay until
// the request answers, so its result is said. A 401 has signed the user out, who may leave.
onBeforeRouteLeave(() => !busy.value || !auth.signedIn);

function open(next: Dialog, from: Event): void {
  if (stale.value) return;
  opener = from.currentTarget instanceof HTMLElement ? from.currentTarget : null;
  writes.clear();
  review.value = null;
  notice.value = null;
  dialog.value = next;
}

async function close(fallback = 'catalog-code'): Promise<void> {
  // Left with its outcome unknown: the page may not show what is saved, and says so until that course is read again.
  if (writes.problem.value?.outcome === 'unknown') stale.value = written;
  dialog.value = null;
  review.value = null;
  writes.clear();
  await nextTick();
  (opener?.isConnected && !(opener as HTMLButtonElement).disabled ? opener : document.getElementById(stale.value ? 'catalog-reload' : fallback))?.focus();
  opener = null;
}

/** Reads the course of the write whose outcome was left unknown, and shows it: the page is up to date again. */
async function reloadStale(): Promise<void> {
  const of = stale.value;
  if (!of) return;
  try {
    await refresh(of);
    stale.value = null;
    typed.value = of;
  } catch (e) {
    if (readFailure(e).kind !== 'signed_out') console.error('Reloading the catalog course failed:', e);
  }
}

/** Cancel (UC-11 A6): the draft, and a review not yet confirmed, are dropped and nothing is sent. */
function cancel(): void {
  if (!busy.value) void close();
}

/**
 * Shows the saved course after a write the API confirmed. When the reload fails, `answered` (the course as the
 * API answered the write) is shown instead, with the curricula already known for it.
 */
async function showSaved(of: string, answered?: Course): Promise<void> {
  try {
    await refresh(of);
  } catch (e) {
    if (readFailure(e).kind === 'signed_out') return;
    console.error('Reloading the catalog course after a save failed:', e);
    if (!answered) return;
    course.value = { ...answered, memberships: course.value?.code === answered.code ? course.value.memberships : [] };
    code.value = answered.code;
    status.value = 'found';
  }
}

async function finish(result: WriteOutcome<Course>, of: string, saved: string): Promise<boolean> {
  if (result.outcome !== 'saved' && result.outcome !== 'confirmed') return false;
  settling.value = true;
  try {
    if (result.outcome === 'saved') await showSaved(of, result.value);
    await close();
    if (result.outcome === 'saved') toast.show(saved);
    else notice.value = m.value.problem.confirmed;
    return true;
  } finally {
    settling.value = false;
  }
}

async function create(values: CourseValues): Promise<void> {
  const body = newCourseBody(values);
  const stored = storedCode(values.code);
  written = stored;
  const result = await writes.send(
    (token) => createCourse(token, body),
    async () => {
      const saved = await refresh(stored);
      return saved !== null && courseHas(saved, body);
    },
  );
  const created = result.outcome === 'saved' ? result.value.code : stored;
  if (await finish(result, created, text.value.created(created))) typed.value = created;
}

/** Sends a correction, with the review it confirms if any. A 409 that asks for a review opens it; nothing is saved then. */
async function correct(body: ImpactReview['body'], confirming: ImpactReview | null): Promise<void> {
  const of = course.value?.code;
  if (!of) return;
  written = of;
  const result = await writes.send(
    (token) => updateCourse(token, of, confirming ? { ...body, confirmImpact: confirming.reviewVersion } : body),
    async () => {
      const saved = await refresh(of);
      return saved !== null && courseHas(saved, body);
    },
  );
  if (result.outcome === 'refused' && result.failure.kind === 'impact') {
    const { affected, reviewVersion, changed } = result.failure;
    writes.clear();
    // The review compares the values now with the values proposed: after a stale one, read the values again.
    if (changed) await showSaved(of);
    review.value = { body, affected, reviewVersion, changed };
    return;
  }
  await finish(result, of, text.value.saved(of));
}

async function save(values: CourseValues): Promise<void> {
  if (dialog.value?.type === 'create') return create(values);
  if (!course.value) return;
  const body = courseChanges(course.value, values);
  if (Object.keys(body).length === 0) {
    await close();
    toast.show(text.value.noChange);
    return;
  }
  await correct(body, null);
}

/** Confirms the review on screen: the same change, with the reviewVersion the API gave for it. */
async function confirmImpact(): Promise<void> {
  if (review.value) await correct(review.value.body, review.value);
}

async function remove(): Promise<void> {
  const of = course.value?.code;
  if (!of) return;
  written = of;
  const result = await writes.send(
    (token) => deleteCourse(token, of),
    async () => (await refresh(of)) === null,
  );
  if (result.outcome !== 'saved' && result.outcome !== 'confirmed') return;
  // The course and its buttons leave the page first, so the focus goes to the code box.
  course.value = null;
  status.value = 'idle';
  typed.value = '';
  await close();
  if (result.outcome === 'saved') toast.show(text.value.deleted(of));
  else notice.value = m.value.problem.confirmed;
}

/**
 * "Reload the data" after an unknown outcome (UC-11 A7): reads the course of the same write again, which is not
 * sent again, and says what the catalog shows. Saved: the dialog closes with the notice. Not saved: it says so.
 */
async function recheck(): Promise<void> {
  if ((await writes.recheck())?.outcome !== 'confirmed') return;
  if (dialog.value?.type === 'delete') {
    course.value = null;
    status.value = 'idle';
    typed.value = '';
  } else typed.value = code.value;
  await close();
  notice.value = m.value.problem.confirmed;
}

const problem = computed(() => (writes.problem.value ? describeProblem(writes.problem.value, m.value, COURSE_FIELDS) : null));
const details = computed(() => (course.value ? EDITABLE_COURSE_FIELDS.filter((field) => field !== 'nameVi' && field !== 'nameEn').map((field) => ({ field, value: course.value![field] })) : []));
</script>

<template>
  <section class="admin-section" aria-labelledby="catalog-admin-title">
    <div class="card flush">
      <div class="card-head">
        <h2 id="catalog-admin-title">{{ text.heading }}</h2>
        <span class="meta">{{ text.shared }}</span>
      </div>
      <div class="admin-tools">
        <form class="link-form" novalidate @submit.prevent="find">
          <div class="field">
            <label for="catalog-code">{{ text.fields.code }}</label>
            <input id="catalog-code" v-model="typed" class="input mono" autocomplete="off" spellcheck="false" aria-describedby="catalog-hint" data-test="catalog-code" />
          </div>
          <button class="btn" type="submit" :disabled="!typed.trim() || status === 'loading'" data-test="catalog-find"><Icon name="search" size="sm" />{{ text.find }}</button>
          <button class="btn" type="button" :disabled="stale !== null" data-test="catalog-add" @click="open({ type: 'create' }, $event)"><Icon name="plus" size="sm" />{{ text.add }}</button>
        </form>
        <p id="catalog-hint" class="hint">{{ text.lookupHint }}</p>

        <p v-if="notice" class="callout ok" role="status" data-test="admin-notice"><Icon name="check" /><span>{{ notice }}</span></p>
        <p v-if="stale" class="callout warn" role="alert" data-test="catalog-stale">
          <Icon name="alert" /><span>{{ m.stale }} <button id="catalog-reload" class="btn sm" type="button" data-test="catalog-reload" @click="reloadStale">{{ m.reload }}</button></span>
        </p>
        <p v-if="status === 'loading'" class="t3" role="status">{{ m.loading }}</p>
        <p v-else-if="status === 'failed'" class="callout bad" role="alert" data-test="catalog-failed">
          <Icon name="alert" /><span>{{ text.lookupFailed }} <button class="btn sm" type="button" @click="find">{{ m.retry }}</button></span>
        </p>
        <p v-else-if="status === 'missing'" class="callout" role="status" data-test="catalog-not-found">
          <Icon name="info" /><span>{{ text.notFound(code) }} {{ text.notFoundAdd }}</span>
        </p>
      </div>

      <div v-if="course" class="catalog-course" data-test="catalog-course" :data-course="course.code">
        <div class="catalog-head">
          <div>
            <p><span class="code">{{ course.code }}</span></p>
            <h3 data-test="catalog-name">{{ course.nameVi }}</h3>
            <p class="small t3" lang="en" data-test="catalog-name-en">{{ course.nameEn ?? '' }}</p>
          </div>
          <div class="head-actions">
            <button class="btn sm" type="button" :disabled="stale !== null" :aria-label="text.editLabel(course.code)" data-test="catalog-edit" @click="open({ type: 'edit' }, $event)"><Icon name="edit" size="sm" />{{ text.edit }}</button>
            <button class="btn sm" type="button" :disabled="stale !== null" :aria-label="text.deleteLabel(course.code)" data-test="catalog-delete" @click="open({ type: 'delete' }, $event)"><Icon name="trash" size="sm" />{{ text.delete }}</button>
          </div>
        </div>
        <dl class="catalog-facts">
          <div v-for="item in details" :key="item.field" :data-test="`catalog-${item.field}`">
            <dt>{{ text.fields[item.field] }}</dt>
            <dd>{{ item.value ?? text.blank }}</dd>
          </div>
        </dl>
        <div>
          <h4 id="catalog-used-title">{{ text.usedIn }}</h4>
          <p v-if="course.memberships.length === 0" class="small t2" data-test="catalog-unused">{{ text.usedInNone }}</p>
          <ul v-else class="catalog-used" aria-labelledby="catalog-used-title">
            <li v-for="item in course.memberships" :key="item.requirementGroupId" data-test="catalog-membership">
              {{ text.membership(item.programCode, item.cohortYear, item.requirementGroupName) }}
            </li>
          </ul>
        </div>
      </div>
    </div>

    <CourseDialog
      :open="dialog?.type === 'create' || dialog?.type === 'edit'"
      :course="dialog?.type === 'edit' ? course : null"
      :start-code="status === 'missing' ? code : ''"
      :busy="busy"
      :problem="dialog?.type === 'delete' ? null : problem"
      :review="review"
      @close="cancel"
      @save="save"
      @confirm="confirmImpact"
      @back="review = null"
      @reload="recheck"
    />
    <ConfirmDialog
      :open="dialog?.type === 'delete'"
      :title="course ? text.deleteTitle(course.code) : ''"
      :body="course ? text.deleteBody(course.code) : ''"
      :confirm="text.delete"
      :busy="busy"
      :problem="dialog?.type === 'delete' ? problem : null"
      @close="cancel"
      @confirm="remove"
      @reload="recheck"
    />
  </section>
</template>

<style>
.catalog-course { border-top: 1px solid var(--edge); padding: 18px 22px 22px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
.catalog-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.catalog-head h3 { font-size: 19px; margin-top: 6px; overflow-wrap: anywhere; }
.catalog-facts { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.catalog-facts > div { background: var(--surface-2); border-radius: 12px; padding: 10px 14px; }
.catalog-facts dt { font-size: 12.5px; font-weight: 650; color: var(--ink-3); }
.catalog-facts dd { margin: 2px 0 0; font-weight: 650; }
.catalog-course h4 { font-size: 13.5px; font-weight: 650; margin: 0 0 6px; }
.catalog-used { margin: 0; padding-left: 18px; display: grid; gap: 2px; font-size: 14px; }
@media (max-width: 620px) {
  .catalog-course { padding: 16px; }
}
</style>
