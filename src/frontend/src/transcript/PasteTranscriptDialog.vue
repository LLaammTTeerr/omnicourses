<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ModalDialog from '../components/ModalDialog.vue';
import { useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { TRANSCRIPT_MESSAGES } from './messages.js';
import { parseTranscriptPaste, type PastedRow } from './paste.js';
import { MAX_ROWS } from './rows.js';

const props = defineProps<{ open: boolean; currentCount: number }>();
const emit = defineEmits<{ close: []; append: [rows: PastedRow[]]; replace: [rows: PastedRow[]] }>();

const m = useMessages(TRANSCRIPT_MESSAGES);
const raw = ref('');

watch(
  () => props.open,
  (open) => {
    if (open) raw.value = '';
  },
);

const hasInput = computed(() => raw.value.trim().length > 0);
const parsed = computed(() => parseTranscriptPaste(raw.value));
const clean = computed(() => parsed.value.rows.length > 0 && parsed.value.errors.length === 0);
const overReplaceLimit = computed(() => parsed.value.rows.length > MAX_ROWS);
const overAppendLimit = computed(() => props.currentCount + parsed.value.rows.length > MAX_ROWS);
const canReplace = computed(() => clean.value && !overReplaceLimit.value);
const canAppend = computed(() => clean.value && !overAppendLimit.value);
</script>

<template>
  <ModalDialog
    class="paste-dialog"
    :open="open"
    labelledby="paste-transcript-title"
    describedby="paste-transcript-lead"
    data-test="paste-dialog"
    @close="emit('close')"
  >
    <h2 id="paste-transcript-title">{{ m.pasteTitle }}</h2>
    <p id="paste-transcript-lead" class="t2 small">{{ m.pasteLead }}</p>

    <div class="field">
      <label for="paste-transcript-input">{{ m.pasteLabel }}</label>
      <textarea
        id="paste-transcript-input"
        v-model="raw"
        class="input mono paste-area"
        rows="6"
        :placeholder="m.pastePlaceholder"
        spellcheck="false"
        autofocus
        data-test="paste-input"
      />
      <p class="hint">{{ m.pasteHint }}</p>
    </div>

    <div v-if="hasInput" class="preview-block">
      <div class="preview-summary" role="status" data-test="paste-summary">
        <span class="chip ok">{{ m.pasteParsedCount(parsed.rows.length) }}</span>
        <span v-if="parsed.errors.length > 0" class="chip bad">{{ m.pasteErrorCount(parsed.errors.length) }}</span>
      </div>

      <div v-if="parsed.errors.length > 0" class="callout bad small error-box" role="alert" data-test="paste-errors">
        <Icon name="alert" size="sm" />
        <div class="error-content">
          <b>{{ m.pasteFixFirst }}</b>
          <ul class="error-list">
            <li v-for="err in parsed.errors" :key="err.line" data-test="paste-error">
              <b>{{ m.pasteLineError(err.line, m.pasteReasons[err.reason]) }}</b> — <code class="mono">{{ err.text }}</code>
            </li>
          </ul>
        </div>
      </div>

      <p v-if="clean && (overReplaceLimit || overAppendLimit)" class="callout warn small" role="alert" data-test="paste-limit">
        <Icon name="alert" size="sm" /><span>{{ m.pasteOverLimit }}</span>
      </p>

      <div v-if="parsed.rows.length > 0" class="table-wrap preview-table-wrap" data-test="paste-preview">
        <table class="table preview-table">
          <thead>
            <tr>
              <th scope="col">{{ m.columns.term }}</th>
              <th scope="col">{{ m.columns.courseCode }}</th>
              <th scope="col">{{ m.columns.courseName }}</th>
              <th scope="col">{{ m.columns.credits }}</th>
              <th scope="col">{{ m.columns.result }}</th>
              <th scope="col">{{ m.columns.grade }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in parsed.rows" :key="i" data-test="paste-preview-row">
              <td>{{ m.term(row.year, row.number) }}</td>
              <td><span class="code">{{ row.courseCode }}</span></td>
              <td>{{ row.courseName }}</td>
              <td>{{ row.credits }}</td>
              <td>{{ m.results[row.result || 'in_progress'] }}</td>
              <td>{{ row.result === 'graded' ? row.grade : m.noGrade }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="acts">
      <button class="btn" type="button" data-test="paste-cancel" @click="emit('close')">{{ m.pasteCancel }}</button>
      <button class="btn" type="button" data-test="paste-replace" :disabled="!canReplace" @click="emit('replace', parsed.rows)">
        {{ m.pasteReplace }}
      </button>
      <button class="btn primary" type="button" data-test="paste-append" :disabled="!canAppend" @click="emit('append', parsed.rows)">
        {{ m.pasteAppend }}
      </button>
    </div>
  </ModalDialog>
</template>

<style scoped>
dialog.modal.paste-dialog { width: min(720px, calc(100vw - 24px)); }
.paste-area { resize: vertical; min-height: 120px; line-height: 1.45; }
.preview-block { display: grid; gap: 10px; min-width: 0; }
.preview-summary { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.error-box { max-height: 160px; overflow-y: auto; }
.error-content { min-width: 0; }
.error-list { margin: 6px 0 0; padding-left: 18px; display: grid; gap: 4px; }
.error-list code { word-break: break-all; }
.preview-table-wrap { max-height: 220px; overflow-y: auto; border: 1px solid var(--edge); border-radius: 10px; }
.preview-table th, .preview-table td { padding: 8px 10px; font-size: 13px; }
</style>
