<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { RouterLink } from 'vue-router';
import { newestOnly } from '../async-load.js';
import { isCourseCode } from '../course-code.js';
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
import { useAdminDialog, type WriteOutcome } from './write.js';

const toast = useToast();
const m = useMessages(ADMIN_MESSAGES);
const text = computed(() => m.value.catalog);

const typed = ref('');
const course = shallowRef<CourseDetail | null>(null);
const code = ref('');
const status = ref<'idle' | 'loading' | 'found' | 'missing' | 'failed'>('idle');
const creatable = computed(() => status.value === 'missing' && isCourseCode(code.value));
const newest = newestOnly();

async function read(of: string): Promise<CourseDetail | null> {
  try {
    return await fetchCourse(of);
  } catch (e) {
    if (readFailure(e).kind === 'not_found') return null;
    throw e;
  }
}

async function refresh(of = code.value): Promise<CourseDetail | null> {
  const isNewest = newest.start();
  const fresh = await read(of);
  if (isNewest()) {
    code.value = of;
    course.value = fresh;
    status.value = fresh ? 'found' : 'missing';
  }
  return fresh;
}

async function find(): Promise<void> {
  const wanted = storedCode(typed.value);
  if (!wanted) return;
  notice.value = false;
  course.value = null;
  status.value = 'loading';
  const isNewest = newest.upcoming();
  try {
    await refresh(wanted);
  } catch (e) {
    if (!isNewest() || readFailure(e).kind === 'signed_out') return;
    console.error('Loading a catalog course failed:', e);
    code.value = wanted;
    status.value = 'failed';
  }
}

type Dialog = { type: 'create' } | { type: 'edit' } | { type: 'delete' };
const review = shallowRef<ImpactReview | null>(null);
const editing = shallowRef<CourseDetail | null>(null);
const notice = ref(false);
let written = '';
const stale = ref<string | null>(null);

const { dialog, writes, busy, close, cancel, finish: finishDialog, ...dialogs } = useAdminDialog<Dialog>({
  fallback: 'catalog-code',
  notice,
  stale: { reloadId: 'catalog-reload', is: () => stale.value !== null, mark: () => (stale.value = written) },
  onClose: () => {
    review.value = null;
    editing.value = null;
  },
});

function open(next: Dialog, from: Event): void {
  if (stale.value) return;
  review.value = null;
  notice.value = false;
  editing.value = next.type === 'edit' ? course.value : null;
  dialogs.open(next, from);
}

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

const finish = (result: WriteOutcome<Course>, of: string, saved: string): Promise<boolean> =>
  finishDialog(result, saved, { before: () => (result.outcome === 'saved' ? showSaved(of, result.value) : undefined) });

async function create(values: CourseValues): Promise<void> {
  const body = newCourseBody(values);
  const stored = storedCode(values.code);
  written = stored;
  const result = await writes.send(
    () => createCourse(body),
    async () => {
      const saved = await refresh(stored);
      return saved !== null && courseHas(saved, body);
    },
  );
  const created = result.outcome === 'saved' ? result.value.code : stored;
  if (await finish(result, created, text.value.created(created))) typed.value = created;
}

async function correct(body: ImpactReview['body'], confirming: ImpactReview | null): Promise<void> {
  const of = (course.value ?? editing.value)?.code;
  if (!of) return;
  written = of;
  const result = await writes.send(
    () => updateCourse(of, confirming ? { ...body, confirmImpact: confirming.reviewVersion } : body),
    async () => {
      const saved = await refresh(of);
      return saved !== null && courseHas(saved, body);
    },
  );
  if (result.outcome === 'refused' && result.failure.kind === 'impact') {
    const { affected, reviewVersion, changed } = result.failure;
    writes.clear();
    if (changed) await showSaved(of);
    review.value = { body, affected, reviewVersion, changed };
    return;
  }
  await finish(result, of, text.value.saved(of));
}

async function save(values: CourseValues): Promise<void> {
  if (dialog.value?.type === 'create') return create(values);
  const base = course.value && course.value.code === editing.value?.code ? course.value : editing.value;
  if (!base) return;
  const body = courseChanges(base, values);
  if (Object.keys(body).length === 0) {
    await close();
    toast.show(text.value.noChange);
    return;
  }
  await correct(body, null);
}

async function confirmImpact(): Promise<void> {
  if (review.value) await correct(review.value.body, review.value);
}

async function remove(): Promise<void> {
  const of = course.value?.code;
  if (!of) return;
  written = of;
  const result = await writes.send(
    () => deleteCourse(of),
    async () => (await refresh(of)) === null,
  );
  if (result.outcome !== 'saved' && result.outcome !== 'confirmed') return;
  course.value = null;
  status.value = 'idle';
  typed.value = '';
  await close();
  if (result.outcome === 'saved') toast.show(text.value.deleted(of));
  else notice.value = true;
}

async function recheck(): Promise<void> {
  if ((await writes.recheck())?.outcome !== 'confirmed') return;
  if (dialog.value?.type === 'delete') {
    course.value = null;
    status.value = 'idle';
    typed.value = '';
  } else typed.value = code.value;
  await close();
  notice.value = true;
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
        <RouterLink class="btn sm" :to="{ name: 'admin-import', query: { type: 'catalog_courses' } }" data-test="open-import">{{ text.importLink }}</RouterLink>
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

        <p v-if="notice" class="callout ok" role="status" data-test="admin-notice"><Icon name="check" /><span>{{ m.problem.confirmed }}</span></p>
        <p v-if="stale" class="callout warn" role="alert" data-test="catalog-stale">
          <Icon name="alert" /><span>{{ m.stale }} <button id="catalog-reload" class="btn sm" type="button" data-test="catalog-reload" @click="reloadStale">{{ m.reload }}</button></span>
        </p>
        <p v-if="status === 'loading'" class="t3" role="status">{{ m.loading }}</p>
        <p v-else-if="status === 'failed'" class="callout bad" role="alert" data-test="catalog-failed">
          <Icon name="alert" /><span>{{ text.lookupFailed }} <button class="btn sm" type="button" @click="find">{{ m.retry }}</button></span>
        </p>
        <p v-else-if="status === 'missing'" class="callout" role="status" data-test="catalog-not-found">
          <Icon name="info" /><span>{{ text.notFound(code) }} {{ creatable ? text.notFoundAdd : text.notACode }}</span>
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
      :course="dialog?.type === 'edit' ? (course ?? editing) : null"
      :start-code="creatable ? code : ''"
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

<style scoped>
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
