<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import ModalDialog from '../components/ModalDialog.vue';
import type { CourseDetail } from '../curriculum/api.js';
import { useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { SHELL_MESSAGES } from '../shell/messages.js';
import FieldErrors from './FieldErrors.vue';
import { courseValues, EDITABLE_COURSE_FIELDS, type CourseField, type CourseValues, type ImpactReview } from './forms.js';
import { ADMIN_MESSAGES } from './messages.js';
import type { ProblemView } from './problem.js';
import ProblemNote from './ProblemNote.vue';

// A catalog course, to create one or to correct one (ADR 0011, UC-11 A8; UI prototypes: admin.html, the catalog
// drawer). The form checks nothing: the API validates the code and the numbers. A correction to a course that
// curricula link is not saved at once: the API answers with those curricula, and the dialog shows them, with the
// values now and the values proposed, for the maintainer to confirm. `review` holds that answer.

const props = defineProps<{
  open: boolean;
  /** The course to correct; null to create one. */
  course: CourseDetail | null;
  /** The code a new course starts with, such as the code just looked up and not found. */
  startCode: string;
  busy: boolean;
  problem: ProblemView<CourseField> | null;
  review: ImpactReview | null;
}>();
const emit = defineEmits<{ close: []; save: [values: CourseValues]; confirm: []; back: []; reload: [] }>();
const m = useMessages(ADMIN_MESSAGES);
const shell = useMessages(SHELL_MESSAGES);
const text = computed(() => m.value.catalog);

const values = reactive<CourseValues>(courseValues(null));
watch(
  () => props.open,
  (open) => {
    if (open) Object.assign(values, courseValues(props.course), props.course ? {} : { code: props.startCode });
  },
  { immediate: true },
);

const NUMBERS = ['credits', 'theoryPeriods', 'labPeriods', 'exercisePeriods', 'projectPeriods'] as const;
const usedIn = computed(() => [...new Set((props.course?.memberships ?? []).map((item) => item.curriculumCode))]);
const described = (field: CourseField, hint?: string) => [hint, props.problem?.fields[field] && `course-${field}-error`].filter(Boolean).join(' ') || undefined;
const invalid = (field: CourseField) => (props.problem?.fields[field] ? 'true' : undefined);

/** A value in the review table: an empty one in words. */
const shown = (value: unknown) => (value === null || value === undefined || value === '' ? text.value.blank : String(value));
const changes = computed(() =>
  EDITABLE_COURSE_FIELDS.filter((field) => props.review && Object.hasOwn(props.review.body, field)).map((field) => ({
    field,
    from: shown(props.course?.[field]),
    to: shown((props.review!.body as Record<string, unknown>)[field]),
  })),
);
</script>

<template>
  <ModalDialog :open="open" class="course-dialog" labelledby="course-dialog-title" :busy="busy" :busy-text="shell.working" data-test="course-dialog" @close="emit('close')">
    <h2 id="course-dialog-title">{{ review ? text.reviewTitle : course ? text.dialogEdit(course.code) : text.dialogNew }}</h2>

    <!-- The shared-impact review: nothing is saved until it is confirmed. -->
    <div v-if="review && course" class="admin-form" data-test="impact-review">
      <p v-if="review.changed" class="callout bad small" role="alert" data-test="impact-changed"><Icon name="alert" size="sm" /><span>{{ text.reviewChanged }}</span></p>
      <p class="t2 small">{{ text.reviewLead }}</p>
      <div class="table-wrap">
        <table class="table impact-changes">
          <caption class="sr-only">{{ text.reviewChanges }}</caption>
          <thead>
            <tr><th scope="col">{{ text.reviewField }}</th><th scope="col">{{ text.reviewOld }}</th><th scope="col">{{ text.reviewNew }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="change in changes" :key="change.field" data-test="impact-change" :data-field="change.field">
              <th scope="row">{{ text.fields[change.field] }}</th>
              <td>{{ change.from }}</td>
              <td class="b">{{ change.to }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <h3 id="impact-affected-title" data-test="impact-count">{{ text.reviewAffected(review.affected.length) }}</h3>
        <ul class="impact-list" aria-labelledby="impact-affected-title">
          <li v-for="item in review.affected" :key="item.curriculumId" data-test="impact-curriculum" :data-curriculum="item.curriculumCode">
            {{ text.affected(item.programCode, item.cohortYear, item.curriculumCode) }}
          </li>
        </ul>
      </div>
      <ProblemNote :problem="problem" @reload="emit('reload')" />
      <div class="acts">
        <button class="btn" type="button" :disabled="busy" data-test="dialog-cancel" @click="emit('close')">{{ m.cancel }}</button>
        <button class="btn" type="button" :disabled="busy" data-test="impact-back" @click="emit('back')">{{ text.reviewBack }}</button>
        <button class="btn primary" type="button" :disabled="busy" data-test="impact-confirm" @click="emit('confirm')">{{ busy ? m.saving : text.reviewConfirm }}</button>
      </div>
    </div>

    <form v-else class="admin-form" novalidate @submit.prevent="emit('save', { ...values })">
      <div v-if="usedIn.length" class="callout warn small" data-test="shared-warning">
        <Icon name="alert" size="sm" />
        <div><b>{{ text.sharedWarningTitle }}</b><p>{{ text.sharedWarningText(usedIn.join(', ')) }}</p></div>
      </div>
      <div class="field">
        <label for="course-code">{{ text.fields.code }}</label>
        <input
          id="course-code"
          v-model="values.code"
          class="input mono"
          autocomplete="off"
          spellcheck="false"
          :readonly="course !== null"
          :autofocus="course === null"
          data-test="course-code"
          :aria-invalid="invalid('code')"
          :aria-describedby="described('code', 'course-code-hint')"
        />
        <p id="course-code-hint" class="hint">{{ course ? text.codeFixed : text.codeHint }}</p>
        <FieldErrors id="course-code-error" :errors="problem?.fields.code" />
      </div>
      <div class="field">
        <label for="course-nameVi">{{ text.fields.nameVi }}</label>
        <input id="course-nameVi" v-model="values.nameVi" class="input" autocomplete="off" :autofocus="course !== null" data-test="course-nameVi" :aria-invalid="invalid('nameVi')" :aria-describedby="described('nameVi')" />
        <FieldErrors id="course-nameVi-error" :errors="problem?.fields.nameVi" />
      </div>
      <div class="field">
        <label for="course-nameEn">{{ text.fields.nameEn }}</label>
        <input id="course-nameEn" v-model="values.nameEn" class="input" autocomplete="off" lang="en" data-test="course-nameEn" :aria-invalid="invalid('nameEn')" :aria-describedby="described('nameEn', 'course-nameEn-hint')" />
        <p id="course-nameEn-hint" class="hint">{{ text.nameEnHint }}</p>
        <FieldErrors id="course-nameEn-error" :errors="problem?.fields.nameEn" />
      </div>
      <div class="course-numbers">
        <div v-for="field in NUMBERS" :key="field" class="field">
          <label :for="`course-${field}`">{{ text.fields[field] }}</label>
          <input
            :id="`course-${field}`"
            v-model="values[field]"
            class="input"
            inputmode="numeric"
            autocomplete="off"
            :data-test="`course-${field}`"
            :aria-invalid="invalid(field)"
            :aria-describedby="described(field, field === 'credits' ? undefined : 'course-periods-hint')"
          />
          <FieldErrors :id="`course-${field}-error`" :errors="problem?.fields[field]" />
        </div>
      </div>
      <p id="course-periods-hint" class="hint">{{ course ? text.periodsHintEdit : text.periodsHintNew }}</p>
      <ProblemNote :problem="problem" @reload="emit('reload')" />
      <div class="acts">
        <button class="btn" type="button" :disabled="busy" data-test="dialog-cancel" @click="emit('close')">{{ m.cancel }}</button>
        <button class="btn primary" type="submit" :disabled="busy" data-test="dialog-save">{{ busy ? m.saving : m.save }}</button>
      </div>
    </form>
  </ModalDialog>
</template>

<style>
dialog.modal.course-dialog { width: min(560px, calc(100vw - 24px)); }
.course-numbers { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; align-items: start; }
.impact-changes th[scope='row'] { text-align: left; font-size: 13.5px; color: var(--ink-2); padding: 12px 14px; border-bottom: 1px solid var(--line); white-space: normal; font-weight: 600; }
.impact-changes td { overflow-wrap: anywhere; }
.impact-list { margin: 8px 0 0; padding-left: 18px; display: grid; gap: 2px; font-size: 14px; }
</style>
