<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import { onBeforeRouteLeave, RouterLink } from 'vue-router';
import { statusOf } from '../api.js';
import { useAsyncLoad } from '../async-load.js';
import { useAuth } from '../auth/store.js';
import SelectMenu from '../components/SelectMenu.vue';
import { fetchCurriculum, type CurriculumCourse } from '../curriculum/api.js';
import { courseName as nameIn } from '../curriculum/present.js';
import { useLocale, useMessages } from '../locale.js';
import { useOnboarding } from '../onboarding/store.js';
import { usePageTitle } from '../page-title.js';
import Icon from '../shell/Icon.vue';
import { useToast } from '../shell/toast.js';
import { fetchTranscript, saveTranscript, TERM_NUMBERS, TRANSCRIPT_RESULTS } from './api.js';
import { TRANSCRIPT_MESSAGES } from './messages.js';
import type { PastedRow } from './paste.js';
import PasteTranscriptDialog from './PasteTranscriptDialog.vue';
import { blankRow, diffRows, fromRow, MAX_ROWS, normalizeCode, problems, toRow, yearChoices, type DraftRow, type Problem } from './rows.js';

const auth = useAuth();
const onboarding = useOnboarding();
const locale = useLocale();
const toast = useToast();
const m = useMessages(TRANSCRIPT_MESSAGES);

const rows = ref<DraftRow[]>([]);
const baseline = shallowRef<readonly DraftRow[]>([]);
let nextKey = 0;
const savedState = ref('[]');
const snapshot = (list: readonly DraftRow[]) => JSON.stringify(list.map(({ key: _key, ...fields }) => fields));

const curriculumCourses = shallowRef<ReadonlyMap<string, CurriculumCourse> | null>(null);
const autoFilled = new WeakMap<DraftRow, { name?: string; credits?: string }>();

async function loadCurriculumInBackground(): Promise<void> {
  try {
    const answers = onboarding.answers ?? (auth.signedIn ? await onboarding.load() : null);
    if (!answers?.finished || !answers.program || answers.cohort === null) {
      curriculumCourses.value = null;
      return;
    }
    const curriculum = await fetchCurriculum(answers.program, answers.cohort);
    const byCode = new Map<string, CurriculumCourse>();
    for (const group of curriculum.requirementGroups) {
      for (const course of group.courses) byCode.set(normalizeCode(course.code), course);
    }
    curriculumCourses.value = byCode;
  } catch {
    curriculumCourses.value = null;
  }
}

void loadCurriculumInBackground();

const { status, reload } = useAsyncLoad('the transcript', async () => {
  const { rows: saved } = await fetchTranscript();
  const loaded = saved.map((row) => fromRow(row, nextKey++));
  baseline.value = loaded.map((row) => ({ ...row }));
  rows.value = loaded;
  savedState.value = snapshot(rows.value);
});

const checked = computed(() => rows.value.map((row) => ({ row, problems: problems(row) })));
const toFix = computed(() => checked.value.filter((entry) => entry.problems.length > 0).length);
const dirty = computed(() => snapshot(rows.value) !== savedState.value);
const diff = computed(() => (dirty.value && baseline.value.length > 0 ? diffRows(baseline.value, rows.value) : null));
const years = computed(() => yearChoices(rows.value));
const counts = computed(() => TRANSCRIPT_RESULTS.map((result) => ({ result, n: rows.value.filter((row) => row.result === result).length })));
const termValue = (row: DraftRow) => `${row.year}-${row.number}`;
const termOptions = computed(() => years.value.flatMap((year) => TERM_NUMBERS.map((n) => ({ value: `${year}-${n}`, label: m.value.term(year, n) }))));
const resultOptions = computed(() => TRANSCRIPT_RESULTS.map((result) => ({ value: result, label: m.value.results[result] })));
function setTerm(row: DraftRow, value: string): void {
  const [year, number] = value.split('-').map(Number);
  row.year = year!;
  row.number = number as DraftRow['number'];
}
const describedBy = (row: DraftRow, rowProblems: Problem[], field: Problem) => (rowProblems.includes(field) ? `problems-${row.key}` : undefined);
const label = (index: number) => m.value.rowLabel(index + 1, normalizeCode(rows.value[index]!.courseCode));

function notInCurriculum(row: DraftRow, rowProblems: readonly Problem[]): boolean {
  if (!curriculumCourses.value || rowProblems.includes('courseCode')) return false;
  return !curriculumCourses.value.has(normalizeCode(row.courseCode));
}

function syncCurriculumAutoFill(row: DraftRow): void {
  const map = curriculumCourses.value;
  if (!map) return;
  const course = map.get(normalizeCode(row.courseCode));
  const previous = autoFilled.get(row);
  if (course) {
    const nextName = nameIn(course, locale.lang);
    const nextCredits = String(course.credits);
    const record: { name?: string; credits?: string } = {};
    if (row.courseName.trim() === '' || (previous?.name !== undefined && row.courseName === previous.name)) {
      row.courseName = nextName;
      record.name = nextName;
    } else if (previous?.name !== undefined) {
      record.name = previous.name;
    }
    if (row.credits.trim() === '' || (previous?.credits !== undefined && row.credits === previous.credits)) {
      row.credits = nextCredits;
      record.credits = nextCredits;
    } else if (previous?.credits !== undefined) {
      record.credits = previous.credits;
    }
    if (record.name !== undefined || record.credits !== undefined) autoFilled.set(row, record);
    return;
  }
  if (previous) {
    if (previous.name !== undefined && row.courseName === previous.name) row.courseName = '';
    if (previous.credits !== undefined && row.credits === previous.credits) row.credits = '';
    autoFilled.delete(row);
  }
}

function onCodeBlur(row: DraftRow): void {
  row.courseCode = normalizeCode(row.courseCode);
  syncCurriculumAutoFill(row);
}

const pasteOpen = ref(false);
const saving = ref(false);
const saveError = ref<string | null>(null);
watch(rows, () => (saveError.value = null), { deep: true });

async function addRow(): Promise<void> {
  rows.value.push(blankRow(nextKey++, rows.value));
  await nextTick();
  document.getElementById(`code-${rows.value.at(-1)!.key}`)?.focus();
}

function appendPastedRows(pasted: readonly PastedRow[]): void {
  if (rows.value.length + pasted.length > MAX_ROWS) return;
  rows.value.push(...pasted.map((row) => ({ key: nextKey++, ...row })));
  pasteOpen.value = false;
  toast.show(m.value.pastedAdded(pasted.length));
}

function replaceWithPastedRows(pasted: readonly PastedRow[]): void {
  if (pasted.length > MAX_ROWS) return;
  rows.value = pasted.map((row) => ({ key: nextKey++, ...row }));
  pasteOpen.value = false;
  toast.show(m.value.pastedReplaced(pasted.length));
}

function cancelEdits(): void {
  rows.value = baseline.value.map((row) => ({ ...row }));
  saveError.value = null;
}

async function removeRow(index: number): Promise<void> {
  const name = label(index);
  rows.value.splice(index, 1);
  toast.show(m.value.removed(name));
  await nextTick();
  document.getElementById('add-row')?.focus();
}

async function save(): Promise<void> {
  if (toFix.value > 0 || saving.value) return;
  saving.value = true;
  try {
    const { rows: saved } = await saveTranscript(rows.value.map(toRow));
    const loaded = saved.map((row) => fromRow(row, nextKey++));
    baseline.value = loaded.map((row) => ({ ...row }));
    rows.value = loaded;
    savedState.value = snapshot(rows.value);
    toast.show(m.value.saved(saved.length));
  } catch (e) {
    const code = statusOf(e);
    if (code === 401) return;
    if (code === 400) saveError.value = m.value.saveRefused;
    else {
      console.error('Saving the transcript failed:', e);
      saveError.value = m.value.saveFailed;
    }
  } finally {
    saving.value = false;
  }
}

onBeforeRouteLeave(() => !dirty.value || !auth.signedIn || window.confirm(m.value.leave));

usePageTitle(() => m.value.title);
</script>

<template>
  <div class="page transcript-page">
    <header class="page-head">
      <div>
        <h1>{{ m.title }}</h1>
        <p>{{ m.lead }}</p>
      </div>
      <RouterLink class="btn" :to="{ name: 'guides' }"><Icon name="book" size="sm" />{{ m.guides }}</RouterLink>
    </header>

    <div class="notes">
      <div class="callout info"><Icon name="file" /><div><b>{{ m.pdfTitle }}</b><p>{{ m.pdfText }}</p></div></div>
      <div class="callout"><Icon name="shield" /><div><b>{{ m.replaceTitle }}</b><p>{{ m.replaceText }}</p></div></div>
    </div>

    <p v-if="status === 'failed'" class="callout bad" role="alert">
      <Icon name="alert" /><span>{{ m.loadFailed }} <button class="btn sm" type="button" @click="reload">{{ m.retry }}</button></span>
    </p>
    <p v-else-if="status === 'loading'" class="t3">{{ m.loading }}</p>

    <template v-else>
      <div class="card status-strip" :class="{ bad: toFix > 0 }">
        <div class="est">
          <span class="cap" aria-hidden="true"><Icon :name="toFix ? 'alert' : 'check'" /></span>
          <div role="status" data-test="summary">
            <b>{{ m.rowsCount(rows.length) }} · {{ toFix ? m.toFix(toFix) : dirty ? m.ready : m.unchanged }}</b>
            <small>{{ toFix ? m.blockedNote : m.replaceNote }}</small>
            <span v-if="diff" class="diff-summary" data-test="diff-summary">{{ m.diffSummary(diff.added, diff.changed, diff.removed) }}</span>
          </div>
        </div>
        <ul class="counts" :aria-label="m.resultKinds">
          <li v-for="{ result, n } in counts" :key="result"><b class="chip">{{ n }}</b>{{ m.results[result] }}</li>
        </ul>
        <div class="head-actions">
          <button class="btn" type="button" data-test="open-paste" :disabled="saving" @click="pasteOpen = true">
            <Icon name="copy" size="sm" />{{ m.openPaste }}
          </button>
          <button id="add-row" class="btn" type="button" :disabled="rows.length >= MAX_ROWS || saving" @click="addRow">
            <Icon name="plus" size="sm" />{{ m.addRow }}
          </button>
          <button v-if="dirty" class="btn" type="button" data-test="cancel-edits" :disabled="saving" @click="cancelEdits">
            <Icon name="undo" size="sm" />{{ m.cancelChanges }}
          </button>
          <button class="btn primary" type="button" :disabled="toFix > 0 || !dirty || saving" @click="save">
            <Icon name="check" size="sm" />{{ saving ? m.saving : m.save }}
          </button>
        </div>
      </div>
      <p v-if="rows.length >= MAX_ROWS" class="small t2">{{ m.full }}</p>
      <p v-if="saveError" class="callout bad" role="alert" data-test="save-error"><Icon name="alert" /><span>{{ saveError }}</span></p>

      <section class="card flush review-card" aria-labelledby="review-title">
        <div class="card-head"><h2 id="review-title">{{ m.review }}</h2><span class="meta">{{ m.resultKinds }}</span></div>
        <p v-if="rows.length === 0" class="empty t2">{{ m.empty }}</p>
        <div v-else class="table-wrap">
          <table class="table review" data-test="rows">
            <thead>
              <tr>
                <th scope="col">{{ m.columns.term }}</th>
                <th scope="col">{{ m.columns.courseCode }}</th>
                <th scope="col">{{ m.columns.courseName }}</th>
                <th scope="col">{{ m.columns.credits }}</th>
                <th scope="col">{{ m.columns.result }}</th>
                <th scope="col">{{ m.columns.grade }}</th>
                <th scope="col">{{ m.columns.check }}</th>
                <th scope="col"><span class="sr-only">{{ m.columns.remove }}</span></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="({ row, problems: rowProblems }, i) in checked" :key="row.key">
                <tr :class="{ err: rowProblems.length }" :data-test="`row-${i}`">
                  <td class="term" :data-label="m.columns.term">
                    <SelectMenu
                      :model-value="termValue(row)"
                      :options="termOptions"
                      :aria-label="m.fieldLabel(m.columns.term, label(i))"
                      :aria-invalid="rowProblems.includes('term') || undefined"
                      :aria-describedby="describedBy(row, rowProblems, 'term')"
                      @update:model-value="setTerm(row, $event)"
                    />
                  </td>
                  <td class="code-cell" :data-label="m.columns.courseCode">
                    <input
                      :id="`code-${row.key}`"
                      v-model="row.courseCode"
                      class="input mono code-input"
                      autocomplete="off"
                      spellcheck="false"
                      :aria-label="m.fieldLabel(m.columns.courseCode, label(i))"
                      :aria-invalid="rowProblems.includes('courseCode') || undefined"
                      :aria-describedby="describedBy(row, rowProblems, 'courseCode')"
                      @input="syncCurriculumAutoFill(row)"
                      @blur="onCodeBlur(row)"
                    />
                    <span v-if="notInCurriculum(row, rowProblems)" class="chip warn outside-chip" data-test="not-in-curriculum">
                      {{ m.notInCurriculum }}
                    </span>
                  </td>
                  <td :data-label="m.columns.courseName">
                    <input
                      v-model="row.courseName"
                      class="input"
                      :aria-label="m.fieldLabel(m.columns.courseName, label(i))"
                      :aria-invalid="rowProblems.includes('courseName') || undefined"
                      :aria-describedby="describedBy(row, rowProblems, 'courseName')"
                    />
                  </td>
                  <td :data-label="m.columns.credits">
                    <input
                      v-model="row.credits"
                      class="input num-input"
                      inputmode="numeric"
                      :aria-label="m.fieldLabel(m.columns.credits, label(i))"
                      :aria-invalid="rowProblems.includes('credits') || undefined"
                      :aria-describedby="describedBy(row, rowProblems, 'credits')"
                    />
                  </td>
                  <td :data-label="m.columns.result">
                    <SelectMenu
                      v-model="row.result"
                      :options="resultOptions"
                      :placeholder="m.pickResult"
                      :aria-label="m.fieldLabel(m.columns.result, label(i))"
                      :aria-invalid="rowProblems.includes('result') || undefined"
                      :aria-describedby="describedBy(row, rowProblems, 'result')"
                    />
                  </td>
                  <td :data-label="m.columns.grade">
                    <input
                      v-if="row.result === 'graded'"
                      v-model="row.grade"
                      class="input num-input"
                      inputmode="decimal"
                      :aria-label="m.fieldLabel(m.columns.grade, label(i))"
                      :aria-invalid="rowProblems.includes('grade') || undefined"
                      :aria-describedby="describedBy(row, rowProblems, 'grade')"
                    />
                    <span v-else class="t3">{{ m.noGrade }}</span>
                  </td>
                  <td class="check-cell" :data-label="m.columns.check" data-test="check">
                    <span v-if="rowProblems.length" class="st bad"><Icon name="alert" size="sm" />{{ m.needsFixShort }}</span>
                    <span v-else class="st ok"><Icon name="check" size="sm" />{{ m.ok }}</span>
                  </td>
                  <td class="r">
                    <button class="btn sm ghost icon-only" type="button" :aria-label="m.removeRow(label(i))" :title="m.removeRow(label(i))" @click="removeRow(i)">
                      <Icon name="trash" size="sm" />
                    </button>
                  </td>
                </tr>
                <tr v-if="rowProblems.length" class="problems">
                  <td :id="`problems-${row.key}`" colspan="8" :data-test="`problems-${i}`">
                    {{ m.needsFix }} {{ rowProblems.map((p) => m.problems[p]).join(', ') }}
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>
      <p class="small t3">{{ m.engineNote }}</p>

      <PasteTranscriptDialog
        :open="pasteOpen"
        :current-count="rows.length"
        @close="pasteOpen = false"
        @append="appendPastedRows"
        @replace="replaceWithPastedRows"
      />
    </template>
  </div>
</template>

<style scoped>
.transcript-page .notes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.status-strip { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 14px 20px; align-items: center; }
.status-strip .est { display: flex; gap: 12px; align-items: center; }
.status-strip .cap { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: color-mix(in oklab, var(--ok) 15%, var(--surface)); color: var(--ok); flex: none; }
.status-strip.bad .cap { background: color-mix(in oklab, var(--bad) 14%, var(--surface)); color: var(--bad); }
.status-strip .est b { display: block; }
.status-strip .est small { display: block; color: var(--ink-3); font-size: 13px; }
.diff-summary { display: inline-block; margin-top: 2px; font-family: var(--mono); font-size: 12.5px; font-weight: 650; color: var(--info); }
.counts { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 13px; color: var(--ink-2); }
.counts li { display: inline-flex; align-items: center; gap: 6px; }
.review-card { container-type: inline-size; }
.review td { padding: 8px 6px; }
.review th { padding: 10px 6px; }
.review th:first-child, .review td:first-child { padding-left: 16px; }
.review th:last-child, .review td:last-child { padding-right: 12px; }
.review :deep(.select), .review .input { min-height: 36px; padding: 4px 8px; border-radius: 9px; }
.review .term :deep(.select) { width: auto; }
.review .code-input { width: 104px; text-transform: uppercase; }
.code-cell { vertical-align: middle; }
.outside-chip { display: inline-flex; margin-top: 4px; min-height: 22px; padding: 0 8px; font-size: 11.5px; }
.review .num-input { width: 64px; }
.review td:nth-child(3) .input { min-width: 140px; }
.review tr.err td, .review tr.problems td { background: color-mix(in oklab, var(--bad) 7%, var(--surface)); }
.review tr.err td { border-bottom: 0; }
.review tr.problems td { padding-top: 0; font-size: 13px; font-weight: 650; color: color-mix(in oklab, var(--bad) 85%, var(--ink)); }
.st { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 650; white-space: nowrap; }
.st.ok { color: color-mix(in oklab, var(--ok) 80%, var(--ink)); }
.st.bad { color: color-mix(in oklab, var(--bad) 85%, var(--ink)); }
.empty { padding: 32px 22px; text-align: center; }
@media (max-width: 1100px) {
  .status-strip { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
  .transcript-page .notes { grid-template-columns: 1fr; }
}
@container (max-width: 860px) {
  .review thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .review, .review tbody { display: block; }
  .review tr { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; padding: 14px 16px; border-top: 1px solid var(--line); }
  .review tr.err, .review tr.problems { background: color-mix(in oklab, var(--bad) 7%, var(--surface)); }
  .review tr.problems { border-top: 0; padding-top: 0; display: block; }
  .review td { display: grid; gap: 4px; padding: 0 !important; border: 0; min-width: 0; background: none !important; }
  .review td[data-label]::before { content: attr(data-label); font-size: 12px; font-weight: 650; color: var(--ink-3); }
  .review .term, .review td:nth-child(3) { grid-column: 1 / -1; }
  .review .term :deep(.select), .review .code-input, .review .num-input, .review td:nth-child(3) .input { width: 100%; min-width: 0; }
  .outside-chip { justify-self: start; }
  .review td.r { justify-self: end; align-self: end; }
}
</style>
