<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import { newestOnly } from '../async-load.js';
import SelectMenu from '../components/SelectMenu.vue';
import { useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { useToast } from '../shell/toast.js';
import {
  BYTES_PER_KIB,
  BYTES_PER_MIB,
  confirmCatalogImport,
  confirmLinkImport,
  IMPORT_FILE_TYPES,
  previewCatalogImport,
  previewLinkImport,
  type CatalogImportRow,
  type CohortRef,
  type ImportFileType,
  type ImportPreview,
  type ImportRowError,
} from './api.js';
import { headerLine, overLimit, readCsvFile, templateHref, templateName, utf8Bytes } from './csv-file.js';
import { readFailure, type Failure } from './errors.js';
import { ADMIN_MESSAGES } from './messages.js';
import { describeProblem } from './problem.js';
import ProblemNote from './ProblemNote.vue';
import { useAdminAccess, useProgramPicker } from './store.js';
import { stayWhileBusy, useWrites } from './write.js';

// CSV bulk entry (ADR 0011, "CSV contract and UC-11 handoff"; UC-11 A9): catalog courses for a catalog maintainer,
// or the group links of one cohort for its program administrator. The file is read in the browser and sent as JSON
// text to the preview route, which writes nothing; Confirm sends the same text with the preview's review version,
// and the API saves the whole file or nothing. Cancel sends nothing. Every check is the API's: this page checks only
// the input limits, so that a file far too large is not sent, and reads no value of a row.
const access = useAdminAccess();
const route = useRoute();
const toast = useToast();
const m = useMessages(ADMIN_MESSAGES);
const text = computed(() => m.value.import);

// ---------- The file type, and for group links the cohort ----------
const offered = computed(() => IMPORT_FILE_TYPES.filter((type) => access.holds(type === 'catalog_courses' ? 'catalog_maintainer' : 'program_admin')));
const asked = typeof route.query.type === 'string' ? route.query.type : null;
const type = ref<ImportFileType | null>(null);
watch(
  offered,
  (list) => {
    if (type.value && list.includes(type.value)) return;
    type.value = list.find((item) => item === asked) ?? list[0] ?? null;
  },
  { immediate: true },
);

const { programList, programsStatus, loadPrograms, picked, program, cohort } = useProgramPicker('the programs to import into', {
  programId: typeof route.query.program === 'string' ? route.query.program : null,
  curriculumId: typeof route.query.cohort === 'string' ? route.query.cohort : null,
});
watch(
  type,
  (now) => {
    if (now === 'group_links' && programsStatus.value === 'idle') void loadPrograms();
  },
  { immediate: true },
);


/** Where a file goes: the catalog, or one cohort. The preview and its confirmation keep the one they were made for. */
interface Target {
  type: ImportFileType;
  cohort: CohortRef | null;
}
const target = computed<Target | null>(() => {
  if (type.value === 'catalog_courses') return { type: 'catalog_courses', cohort: null };
  if (type.value === 'group_links' && program.value && cohort.value) return { type: 'group_links', cohort: { programId: program.value.id, curriculumId: cohort.value.id } };
  return null;
});
const targetKey = computed(() => (target.value ? `${target.value.type}:${target.value.cohort?.curriculumId ?? ''}` : ''));

// ---------- The file, read in the browser ----------
const fileInput = ref<HTMLInputElement | null>(null);
/** The text that was read: what is previewed, and sent again as it is on confirmation. */
const draft = shallowRef<{ name: string; bytes: number; csv: string } | null>(null);
const fileProblem = ref<string | null>(null);
const reading = ref(false);

const size = (bytes: number) => (bytes < BYTES_PER_MIB ? `${Math.max(1, Math.round(bytes / BYTES_PER_KIB))} KiB` : `${(bytes / BYTES_PER_MIB).toFixed(1)} MiB`);

async function choose(): Promise<void> {
  const file = fileInput.value?.files?.[0];
  dropPreview();
  draft.value = null;
  fileProblem.value = null;
  notice.value = null;
  if (!file) return;
  reading.value = true;
  try {
    const read = await readCsvFile(file);
    if (!read.ok) {
      fileProblem.value = read.reason === 'not_utf8' ? text.value.notUtf8 : text.value.unreadable;
      return;
    }
    const over = overLimit(read.text);
    if (over) {
      fileProblem.value = over.limit === 'bytes' ? text.value.tooBig(size(over.bytes)) : text.value.tooMany(over.records);
      return;
    }
    draft.value = { name: file.name, bytes: utf8Bytes(read.text), csv: read.text };
  } finally {
    reading.value = false;
  }
}

// ---------- Preview ----------
const preview = shallowRef<{ target: Target; csv: string; result: ImportPreview } | null>(null);
const previewing = ref(false);
/** The preview got no answer. */
const previewLost = ref(false);
/** The API refused the preview: a file it cannot read (by record), a limit, a permission. */
const refusal = shallowRef<Exclude<Failure, { kind: 'no_answer' }> | null>(null);
/** The last confirmation was refused because something changed since the preview, which was then made again. */
const changed = ref(false);
const notice = ref<string | null>(null);
const newest = newestOnly();

function dropPreview(): void {
  newest.drop();
  preview.value = null;
  previewing.value = false;
  previewLost.value = false;
  refusal.value = null;
  changed.value = false;
  writes.clear();
}
// Another file type or another cohort: the preview was for the one before.
watch(targetKey, dropPreview);

const runPreview = (of: Target, csv: string): Promise<ImportPreview> =>
  of.cohort ? previewLinkImport(of.cohort, csv) : previewCatalogImport(csv);

/**
 * Previews `csv` for `of` and shows it. A preview writes nothing, so it is never in doubt: it is simply asked again.
 * Resolves to 'shown', to 'failed' (the preview on screen, if any, is dropped), or to 'stale' when another preview
 * or another target took its place.
 */
async function show(of: Target, csv: string): Promise<'shown' | 'failed' | 'stale'> {
  const isNewest = newest.start();
  previewing.value = true;
  previewLost.value = false;
  refusal.value = null;
  try {
    const result = await runPreview(of, csv);
    if (!isNewest()) return 'stale';
    preview.value = { target: of, csv, result };
    return 'shown';
  } catch (e) {
    if (!isNewest()) return 'stale';
    // An older preview must not stay on screen, with a Confirm for its review version, as if it were the new one.
    preview.value = null;
    const failure = readFailure(e);
    if (failure.kind === 'signed_out') return 'failed';
    if (failure.kind === 'no_answer') {
      console.error('Previewing an import file failed:', e);
      previewLost.value = true;
    } else {
      refusal.value = failure;
      if (failure.kind === 'permission') void access.load({ fresh: true });
    }
    return 'failed';
  } finally {
    if (isNewest()) previewing.value = false;
  }
}

async function previewDraft(): Promise<void> {
  const [of, file] = [target.value, draft.value];
  if (!of || !file || previewing.value || writes.busy.value) return;
  dropPreview();
  notice.value = null;
  await show(of, file.csv);
}

const refusalView = computed(() => (refusal.value && refusal.value.kind !== 'file' ? describeProblem({ outcome: 'refused', failure: refusal.value }, m.value) : null));
/** Where the file is wrong, by record: from a preview, or from a file the API could not read at all. */
const errors = computed<ImportRowError[]>(() => (refusal.value?.kind === 'file' ? refusal.value.errors : (preview.value?.result.errors ?? [])));

// ---------- Confirm or cancel ----------
const writes = useWrites();
/** The preview made again to settle a confirmation that got no answer. */
let landedPreview: { target: Target; csv: string; result: ImportPreview } | null = null;
/** Where the last confirmation went, and the text it sent: its outcome is said for that file and that target. */
let sent: { target: Target; csv: string } | null = null;

stayWhileBusy(() => writes.busy.value || previewing.value);

const changes = computed(() => (preview.value ? preview.value.result.summary.inserts + preview.value.result.summary.updates : 0));
const confirmable = computed(() => !!preview.value?.result.reviewVersion && preview.value.result.errors.length === 0 && changes.value > 0);

async function finishDraft(): Promise<void> {
  dropPreview();
  draft.value = null;
  if (fileInput.value) fileInput.value.value = '';
  await nextTick();
  fileInput.value?.focus();
}

async function confirm(): Promise<void> {
  const shown = preview.value;
  const version = shown?.result.reviewVersion;
  if (!shown || !version || !confirmable.value || writes.busy.value) return;
  const { target: of, csv } = shown;
  notice.value = null;
  changed.value = false;
  landedPreview = null;
  sent = { target: of, csv };
  const result = await writes.send(
    () => (of.cohort ? confirmLinkImport(of.cohort, csv, version) : confirmCatalogImport(csv, version)),
    // A file already saved previews as nothing to do: no error, nothing new, nothing changed.
    async () => {
      const fresh = await runPreview(of, csv);
      landedPreview = { target: of, csv, result: fresh };
      return fresh.errors.length === 0 && fresh.summary.inserts + fresh.summary.updates === 0;
    },
  );
  await settle(result.outcome, result.outcome === 'saved' ? result.value.summary : null, result.outcome === 'refused' ? result.failure : null);
}

async function settle(outcome: string, summary: { inserts: number; updates: number } | null, failure: Failure | null): Promise<void> {
  if (outcome === 'saved' && summary) {
    toast.show(text.value.saved(summary.inserts, summary.updates));
    await finishDraft();
    return;
  }
  if (outcome === 'confirmed') {
    await finishDraft();
    notice.value = m.value.problem.confirmed;
    return;
  }
  // Not saved: what is saved now is the preview just made.
  if (outcome === 'not_applied' && landedPreview) preview.value = landedPreview;
  if (failure?.kind === 'review_changed' && sent) {
    // Nothing was saved, and the 409 carries no new review: preview the same file again, for the same target.
    const { target: of, csv } = sent;
    const refused = writes.problem.value;
    writes.clear();
    const shown = await show(of, csv);
    if (shown === 'shown') changed.value = true;
    // No new preview: say that nothing was saved, beside why the preview failed.
    else if (shown === 'failed') writes.problem.value = refused;
  }
}

/** "Reload the data" after an unknown outcome: the file is previewed again, and nothing is sent to be saved. */
async function recheck(): Promise<void> {
  const result = await writes.recheck();
  if (result) await settle(result.outcome, null, result.outcome === 'refused' ? result.failure : null);
}

/** Cancel (UC-11 A9): the file and its preview are dropped, and nothing is sent. */
async function cancel(): Promise<void> {
  if (writes.busy.value) return;
  const had = draft.value !== null;
  await finishDraft();
  fileProblem.value = null;
  notice.value = null;
  if (had) toast.show(text.value.cancelled);
}

const confirmProblem = computed(() => (writes.problem.value ? describeProblem(writes.problem.value, m.value) : null));

// ---------- What the preview shows ----------
const header = computed(() => (type.value ? headerLine(type.value) : ''));
const headerBox = ref<HTMLInputElement | null>(null);
async function copyHeader(): Promise<void> {
  try {
    await navigator.clipboard.writeText(header.value);
    toast.show(text.value.headerCopied);
  } catch (e) {
    // No clipboard permission, or a page not served over HTTPS: select the header, so one key press copies it.
    console.error('Copying the header failed:', e);
    headerBox.value?.select();
    toast.show(text.value.headerNotCopied);
  }
}

const catalogRows = computed(() => (preview.value?.result.fileType === 'catalog_courses' ? preview.value.result.rows : []));
const linkRows = computed(() => (preview.value?.result.fileType === 'group_links' ? preview.value.result.rows : []));
const affected = computed(() => (preview.value?.result.fileType === 'catalog_courses' ? preview.value.result.affectedCurricula : []));
const blank = (value: unknown) => (value === null || value === undefined || value === '' ? m.value.catalog.blank : String(value));
const changesOf = (row: CatalogImportRow) =>
  row.changedFields.map((field) =>
    text.value.change((m.value.catalog.fields as Record<string, string>)[field] ?? field, blank(row.current?.[field]), blank(row[field])),
  );
const chip = { insert: 'ok', update: 'warn', no_op: '' } as const;

// While a confirmation is out the target stays as it was sent, so its outcome is said for that target.
function pickProgram(programId: string): void {
  if (writes.busy.value) return;
  picked.value = { programId, curriculumId: null };
}
function pickCohort(curriculumId: string): void {
  if (writes.busy.value) return;
  if (program.value) picked.value = { programId: program.value.id, curriculumId };
}
</script>

<template>
  <section class="admin-section" aria-labelledby="import-admin-title">
    <div class="card flush">
      <div class="card-head">
        <h2 id="import-admin-title">{{ text.heading }}</h2>
      </div>
      <div class="admin-tools import-tools">
        <p class="small t2">{{ text.lead }}</p>

        <fieldset class="field admin-choices" :disabled="writes.busy.value">
          <legend>{{ text.typeLegend }}</legend>
          <label v-for="option in offered" :key="option" class="check import-type">
            <input v-model="type" type="radio" name="import-type" :value="option" :data-test="`import-type-${option}`" :aria-describedby="`import-type-${option}-hint`" />
            <span>
              {{ text.types[option] }}
              <span :id="`import-type-${option}-hint`" class="small t2 import-type-hint">{{ text.typeHints[option] }}</span>
            </span>
          </label>
        </fieldset>

        <template v-if="type === 'group_links'">
          <p v-if="programsStatus === 'loading'" class="t3" role="status">{{ m.loading }}</p>
          <p v-else-if="programsStatus === 'failed'" class="callout bad" role="alert" data-test="import-programs-failed">
            <Icon name="alert" /><span>{{ text.programsFailed }} <button class="btn sm" type="button" @click="loadPrograms()">{{ m.retry }}</button></span>
          </p>
          <p v-else-if="!program" class="callout" role="status" data-test="import-no-programs"><Icon name="info" /><span>{{ text.noPrograms }}</span></p>
          <div v-else class="import-target" role="group" :aria-label="text.target">
            <label class="field">
              <span>{{ m.curriculum.program }}</span>
              <SelectMenu :model-value="program.id" :options="(programList ?? []).map((item) => ({ value: item.id, label: `${item.code} · ${item.nameVi}` }))" :disabled="writes.busy.value" data-test="import-program" @update:model-value="pickProgram" />
            </label>
            <label v-if="program.curricula.length" class="field">
              <span>{{ m.curriculum.cohort }}</span>
              <SelectMenu :model-value="cohort?.id" :options="program.curricula.map((item) => ({ value: item.id, label: m.curriculum.cohortOption(item.cohortYear) }))" :disabled="writes.busy.value" data-test="import-cohort" @update:model-value="pickCohort" />
            </label>
            <p v-else class="callout" role="status" data-test="import-no-cohort"><Icon name="info" /><span>{{ text.noCohort }}</span></p>
          </div>
        </template>

        <div v-if="type" class="field">
          <label for="import-header">{{ text.template }}</label>
          <div class="import-header">
            <input id="import-header" ref="headerBox" class="input mono" readonly :value="header" aria-describedby="import-header-hint" data-test="import-header" />
            <button class="btn sm" type="button" data-test="import-copy-header" @click="copyHeader"><Icon name="copy" size="sm" />{{ text.copyHeader }}</button>
            <a class="btn sm" :href="templateHref(type)" :download="templateName(type)" data-test="import-template">{{ text.downloadTemplate }}</a>
          </div>
          <p id="import-header-hint" class="hint">{{ text.templateHint }}</p>
        </div>

        <form v-if="type" class="link-form import-file" novalidate @submit.prevent="previewDraft">
          <div class="field">
            <label for="import-file">{{ text.file }}</label>
            <input
              id="import-file"
              ref="fileInput"
              class="input"
              type="file"
              accept=".csv,text/csv"
              :disabled="writes.busy.value"
              data-test="import-file"
              :aria-invalid="fileProblem ? 'true' : undefined"
              :aria-describedby="fileProblem ? 'import-file-hint import-file-problem' : 'import-file-hint'"
              @change="choose"
            />
          </div>
          <button class="btn primary" type="submit" :disabled="!draft || !target || previewing || writes.busy.value" data-test="import-preview">
            <Icon name="search" size="sm" />{{ previewing ? text.previewing : text.preview }}
          </button>
        </form>
        <p v-if="type" id="import-file-hint" class="hint">{{ text.fileHint }}</p>
        <p v-if="draft" class="small t2" role="status" data-test="import-file-read">{{ text.fileChosen(draft.name, size(draft.bytes)) }}</p>
        <p v-if="fileProblem" id="import-file-problem" class="callout bad" role="alert" data-test="import-file-problem"><Icon name="alert" /><span>{{ fileProblem }}</span></p>

        <p v-if="notice" class="callout ok" role="status" data-test="admin-notice"><Icon name="check" /><span>{{ notice }}</span></p>
        <p v-if="previewLost" class="callout bad" role="alert" data-test="import-preview-failed">
          <Icon name="alert" /><span>{{ text.previewFailed }} <button class="btn sm" type="button" @click="previewDraft">{{ m.retry }}</button></span>
        </p>
        <ProblemNote :problem="refusalView" />
        <ProblemNote v-if="!preview && !errors.length" :problem="confirmProblem" />
      </div>

      <section v-if="preview || errors.length" class="import-preview" aria-labelledby="import-preview-title" data-test="import-result">
        <h3 id="import-preview-title">{{ text.previewTitle }}</h3>
        <p v-if="changed" class="callout warn" role="alert" data-test="import-changed"><Icon name="alert" /><span>{{ text.reviewChanged }}</span></p>
        <p v-if="preview" class="import-summary" data-test="import-summary">{{ text.summary(preview.result.summary.inserts, preview.result.summary.updates, preview.result.summary.noOps) }}</p>

        <div v-if="errors.length" class="import-errors" data-test="import-errors">
          <p class="callout bad" role="alert"><Icon name="alert" /><span>{{ refusal?.kind === 'file' ? m.problem.file : text.errorsTitle(errors.length) }}</span></p>
          <p class="small t3">{{ text.errorsNote }}</p>
          <div class="table-wrap">
            <table class="table admin-cards">
              <thead>
                <tr>
                  <th scope="col">{{ text.errorColumns.record }}</th>
                  <th scope="col">{{ text.errorColumns.field }}</th>
                  <th scope="col">{{ text.errorColumns.message }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(error, i) in errors" :key="i" data-test="import-error" :data-record="error.record" :data-field="error.field ?? ''">
                  <th scope="row">{{ text.errorColumns.record }} {{ error.record }}</th>
                  <td :data-label="text.errorColumns.field" :class="{ mono: error.field }">{{ error.field ?? text.wholeRecord }}</td>
                  <td class="wide" lang="en" :data-label="text.errorColumns.message">{{ error.message }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <template v-if="preview && preview.result.rows.length">
          <h4>{{ text.rowsTitle(preview.result.rows.length) }}</h4>
          <div class="table-wrap">
            <table v-if="catalogRows.length" class="table admin-cards import-rows">
              <thead>
                <tr>
                  <th scope="col">{{ text.columns.record }}</th>
                  <th scope="col">{{ text.columns.action }}</th>
                  <th scope="col">{{ text.columns.code }}</th>
                  <th scope="col">{{ text.columns.name }}</th>
                  <th scope="col" class="r">{{ text.columns.credits }}</th>
                  <th scope="col">{{ text.columns.changes }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in catalogRows" :key="row.record" data-test="import-row" :data-record="row.record" :data-action="row.action">
                  <th scope="row">{{ text.columns.record }} {{ row.record }}</th>
                  <td :data-label="text.columns.action"><span class="chip" :class="chip[row.action]">{{ text.actions[row.action] }}</span></td>
                  <td :data-label="text.columns.code"><span class="code">{{ row.code }}</span></td>
                  <td class="wide" :data-label="text.columns.name">{{ row.nameVi }}</td>
                  <td class="r" :data-label="text.columns.credits">{{ row.credits }}</td>
                  <td class="wide" :data-label="text.columns.changes">
                    <ul v-if="row.action === 'update'" class="import-changes">
                      <li v-for="item in changesOf(row)" :key="item">{{ item }}</li>
                    </ul>
                  </td>
                </tr>
              </tbody>
            </table>
            <table v-else class="table admin-cards import-rows">
              <thead>
                <tr>
                  <th scope="col">{{ text.columns.record }}</th>
                  <th scope="col">{{ text.columns.action }}</th>
                  <th scope="col">{{ text.columns.group }}</th>
                  <th scope="col">{{ text.columns.course }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in linkRows" :key="row.record" data-test="import-row" :data-record="row.record" :data-action="row.action">
                  <th scope="row">{{ text.columns.record }} {{ row.record }}</th>
                  <td :data-label="text.columns.action"><span class="chip" :class="chip[row.action]">{{ text.actions[row.action] }}</span></td>
                  <td class="wide" :data-label="text.columns.group">{{ row.requirementGroupName }}</td>
                  <td :data-label="text.columns.course"><span class="code">{{ row.courseCode }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <div v-if="affected.length" class="callout warn import-affected" data-test="import-affected">
          <Icon name="alert" />
          <div>
            <b id="import-affected-title">{{ text.affectedTitle(affected.length) }}</b>
            <p class="small">{{ text.affectedLead }}</p>
            <ul aria-labelledby="import-affected-title">
              <li v-for="item in affected" :key="item.curriculumId" data-test="import-affected-curriculum" :data-curriculum="item.curriculumCode">
                {{ m.catalog.affected(item.programCode, item.cohortYear, item.curriculumCode) }}
              </li>
            </ul>
          </div>
        </div>

        <p v-if="preview && preview.result.errors.length === 0 && changes === 0" class="callout" role="status" data-test="import-nothing"><Icon name="info" /><span>{{ text.nothingToSave }}</span></p>
        <p v-if="confirmable" class="small t2">{{ text.confirmLead }}</p>
        <ProblemNote :problem="confirmProblem" @reload="recheck" />
        <div class="acts import-acts">
          <button class="btn" type="button" :disabled="writes.busy.value" data-test="import-cancel" @click="cancel">{{ text.cancel }}</button>
          <button class="btn primary" type="button" :disabled="!confirmable || writes.busy.value || previewing || confirmProblem?.reload" data-test="import-confirm" @click="confirm">
            {{ writes.busy.value ? m.saving : text.confirm }}
          </button>
        </div>
      </section>
    </div>
  </section>
</template>

<style>
.import-tools { gap: 14px; }
.import-type { display: flex; gap: 10px; align-items: flex-start; }
.import-type input { margin-top: 4px; }
.import-type-hint { display: block; max-width: 70ch; }
.import-target { display: flex; flex-wrap: wrap; gap: 14px; }
.import-target .field { min-width: 180px; }
.import-header { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.import-header .input { flex: 1 1 320px; min-width: 0; }
.link-form.import-file .field { flex: 1 1 320px; }
.import-preview { border-top: 1px solid var(--edge); padding: 18px 22px 22px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.import-preview h3 { font-size: 17px; }
.import-preview h4 { font-size: 14px; font-weight: 650; margin: 0; }
.import-preview .table-wrap { border: 1px solid var(--edge); border-radius: 12px; }
.import-summary { font-weight: 650; }
.import-errors { display: grid; gap: 8px; }
.import-rows td.wide, .import-errors td.wide { overflow-wrap: anywhere; min-width: 140px; }
.import-changes { margin: 0; padding-left: 16px; font-size: 13px; }
.import-affected > div { display: grid; gap: 4px; min-width: 0; }
.import-affected ul { margin: 0; padding-left: 18px; font-size: 14px; }
/* A cell of a phone card is narrow: a long action wraps inside it instead of running into the code beside it. */
.import-rows .chip { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
.import-acts { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
@media (max-width: 620px) {
  .import-preview { padding: 16px; }
}
</style>
