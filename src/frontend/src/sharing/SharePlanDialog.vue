<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { newestOnly, reportFailure, useAttempt } from '../async-load.js';
import { useAuth } from '../auth/store.js';
import ModalDialog from '../components/ModalDialog.vue';
import { formatDateTime, useLocale, useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { useToast } from '../shell/toast.js';
import { fetchPlanShare, sharedPlanPath, sharedPlanUrl, stopPlanShare, updatePlanShare, type PlanShare } from './api.js';
import { SHARING_MESSAGES } from './messages.js';

const COPY_FEEDBACK_MS = 2_000;

const props = defineProps<{ open: boolean; planId: string; planName: string }>();
const emit = defineEmits<{ close: [] }>();

const auth = useAuth();
const locale = useLocale();
const toast = useToast();
const m = useMessages(SHARING_MESSAGES);

const status = ref<'idle' | 'loading' | 'loaded' | 'failed'>('idle');
const share = shallowRef<PlanShare | null>(null);
const showName = ref(false);
const showTranscriptChecks = ref(false);
const pending = ref<'creating' | 'updating' | 'stopping' | null>(null);
const { busy, error: actionError, run } = useAttempt(() => m.value.actionFailed);
const busyWith = (kind: typeof pending.value) => busy.value && pending.value === kind;
const copied = ref(false);
const copyNotice = ref<string | null>(null);
const urlInput = ref<HTMLInputElement | null>(null);

const loads = newestOnly();
let copyTimer: ReturnType<typeof setTimeout> | undefined;

const shareUrl = computed(() => (share.value ? sharedPlanUrl(share.value.token) : ''));
const shareHref = computed(() => (share.value ? sharedPlanPath(share.value.token) : ''));
const hasUnsavedChoices = computed(
  () =>
    share.value !== null &&
    (showName.value !== share.value.showName || showTranscriptChecks.value !== share.value.showTranscriptChecks),
);
const displayNameLabel = computed(() => {
  const name = auth.user?.displayName?.trim();
  return name ? m.value.showNameWith(name) : m.value.showName;
});

function clearCopyFeedback(): void {
  if (copyTimer !== undefined) {
    clearTimeout(copyTimer);
    copyTimer = undefined;
  }
  copied.value = false;
  copyNotice.value = null;
}

function applyShare(next: PlanShare | null): void {
  share.value = next;
  showName.value = next?.showName ?? false;
  showTranscriptChecks.value = next?.showTranscriptChecks ?? false;
}

async function loadState(): Promise<void> {
  const isNewest = loads.start();
  status.value = 'loading';
  actionError.value = null;
  clearCopyFeedback();
  try {
    const res = await fetchPlanShare(props.planId);
    if (!isNewest()) return;
    applyShare(res.share);
    status.value = 'loaded';
  } catch (e) {
    if (!isNewest()) return;
    reportFailure('Loading the plan share', e);
    status.value = 'failed';
  }
}

watch(
  [() => props.open, () => props.planId],
  ([open]) => {
    if (!open) {
      loads.drop();
      busy.value = false;
      actionError.value = null;
      clearCopyFeedback();
      return;
    }
    void loadState();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  loads.drop();
  clearCopyFeedback();
});

async function createLink(): Promise<void> {
  if (busy.value) return;
  pending.value = 'creating';
  clearCopyFeedback();
  await run('Creating the share link', async () => {
    applyShare(await updatePlanShare(props.planId, { showName: showName.value, showTranscriptChecks: showTranscriptChecks.value }));
    toast.show(m.value.createdToast);
  });
}

async function saveChoices(): Promise<void> {
  if (!share.value || busy.value || !hasUnsavedChoices.value) return;
  pending.value = 'updating';
  await run('Updating the share link', async () => {
    applyShare(await updatePlanShare(props.planId, { showName: showName.value, showTranscriptChecks: showTranscriptChecks.value }));
    toast.show(m.value.savedToast);
  });
}

function scheduleCopiedReset(): void {
  if (copyTimer !== undefined) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copied.value = false;
    copyTimer = undefined;
  }, COPY_FEEDBACK_MS);
}

async function tryWriteClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function copyLink(): Promise<void> {
  const url = shareUrl.value;
  if (!url) return;
  clearCopyFeedback();

  if (await tryWriteClipboard(url)) {
    copied.value = true;
    toast.show(m.value.copiedToast);
    scheduleCopiedReset();
    return;
  }

  const el = urlInput.value;
  if (el) {
    el.focus();
    el.select();
    el.setSelectionRange?.(0, url.length);
  }
  let ok = false;
  try {
    ok = typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch {
    ok = false;
  }
  if (ok) {
    copied.value = true;
    toast.show(m.value.copiedToast);
    scheduleCopiedReset();
  } else {
    copyNotice.value = m.value.copyFallback;
    toast.show(m.value.copyFallback);
  }
}

async function revokeLink(): Promise<void> {
  if (busy.value) return;
  pending.value = 'stopping';
  clearCopyFeedback();
  await run('Stopping the share link', async () => {
    await stopPlanShare(props.planId);
    applyShare(null);
    toast.show(m.value.stoppedToast);
  });
}
</script>

<template>
  <ModalDialog
    class="share-modal"
    :open="open"
    labelledby="share-plan-title"
    describedby="share-plan-lead"
    :busy="busy"
    data-test="share-dialog"
    @close="emit('close')"
  >
    <div class="modal-head">
      <div>
        <h2 id="share-plan-title">{{ m.dialogTitle }}</h2>
        <p id="share-plan-lead" class="t2 small">{{ m.dialogLead(planName) }}</p>
      </div>
      <button
        class="btn sm ghost icon-only"
        type="button"
        :disabled="busy"
        :aria-label="m.close"
        :title="m.close"
        data-test="close-share-dialog"
        @click="emit('close')"
      >
        <Icon name="x" size="sm" />
      </button>
    </div>

    <p v-if="status === 'loading'" class="t3" role="status" data-test="share-loading">{{ m.loading }}</p>

    <div v-else-if="status === 'failed'" class="callout bad small" role="alert" data-test="share-load-failed">
      <Icon name="alert" size="sm" />
      <div class="failed-body">
        <p>{{ m.loadFailed }}</p>
        <button class="btn sm" type="button" data-test="share-retry" @click="loadState">{{ m.retry }}</button>
      </div>
    </div>

    <template v-else-if="status === 'loaded'">
      <div class="box summary-box">
        <b>{{ m.seesHeading }}</b>
        <ul class="small t2">
          <li v-for="(item, i) in m.seesItems" :key="i">{{ item }}</li>
        </ul>
        <b class="never-heading">{{ m.neverShownHeading }}</b>
        <p class="small t2">{{ m.neverShownBody }}</p>
      </div>

      <div class="choices">
        <label class="check">
          <input
            v-model="showName"
            type="checkbox"
            :disabled="busy"
            data-test="share-show-name"
          />
          <span>{{ displayNameLabel }}</span>
        </label>

        <div class="choice-group">
          <label class="check">
            <input
              v-model="showTranscriptChecks"
              type="checkbox"
              :disabled="busy"
              data-test="share-show-transcript-checks"
            />
            <span>
              <span class="choice-title">{{ m.showTranscriptChecks }}</span>
              <span class="hint block-hint">{{ m.transcriptChecksHint }}</span>
            </span>
          </label>

          <div
            v-if="showTranscriptChecks"
            class="callout warn small privacy-warning"
            role="note"
            data-test="transcript-checks-warning"
          >
            <Icon name="alert" size="sm" />
            <div>
              <b>{{ m.transcriptPrivacyWarningTitle }}</b>
              <p>{{ m.transcriptPrivacyWarning }}</p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="share" class="field link-field" data-test="active-share">
        <div class="link-meta">
          <label for="share-plan-url">{{ m.liveLinkLabel }}</label>
          <span class="xs t3">{{ m.createdOn(formatDateTime(share.createdAt, locale.lang)) }}</span>
        </div>
        <div class="url-row">
          <input
            id="share-plan-url"
            ref="urlInput"
            class="input mono"
            type="text"
            readonly
            :value="shareUrl"
            data-test="share-url"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <button class="btn" type="button" data-test="copy-share-link" @click="copyLink">
            <Icon :name="copied ? 'check' : 'copy'" size="sm" />{{ copied ? m.copiedLink : m.copyLink }}
          </button>
        </div>
        <p v-if="copyNotice" class="hint" role="status" data-test="copy-fallback-notice">{{ copyNotice }}</p>
        <p class="hint">{{ m.linkAnyoneNote }}</p>
      </div>

      <div v-else class="callout info small" role="note" data-test="share-anyone-note">
        <Icon name="info" size="sm" />
        <p>{{ m.linkAnyoneNote }}</p>
      </div>

      <p v-if="actionError" class="callout bad small" role="alert" data-test="share-action-error">
        <Icon name="alert" size="sm" />
        <span>{{ actionError }}</span>
      </p>

      <div class="acts share-acts">
        <template v-if="share">
          <button
            class="btn danger stop-btn"
            type="button"
            :disabled="busy"
            data-test="stop-sharing"
            @click="revokeLink"
          >
            <Icon name="lock" size="sm" />{{ busyWith('stopping') ? m.stoppingSharing : m.stopSharing }}
          </button>
          <a
            class="btn"
            :href="shareHref"
            target="_blank"
            rel="noopener noreferrer"
            data-test="open-shared-plan"
          >
            <Icon name="external" size="sm" />{{ m.openShared }}
          </a>
          <button class="btn" type="button" :disabled="busy" @click="emit('close')">{{ m.close }}</button>
          <button
            class="btn primary"
            type="button"
            :disabled="busy || !hasUnsavedChoices"
            data-test="save-share-options"
            @click="saveChoices"
          >
            {{ busyWith('updating') ? m.savingChoices : m.saveChoices }}
          </button>
        </template>
        <template v-else>
          <button class="btn" type="button" :disabled="busy" @click="emit('close')">{{ m.close }}</button>
          <button
            class="btn primary"
            type="button"
            :disabled="busy"
            data-test="create-share-link"
            @click="createLink"
          >
            <Icon name="globe" size="sm" />{{ busyWith('creating') ? m.creatingLink : m.createLink }}
          </button>
        </template>
      </div>
    </template>
  </ModalDialog>
</template>

<style scoped>
.share-modal {
  width: min(560px, calc(100vw - 24px));
}
.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.modal-head p {
  margin-top: 4px;
}
.failed-body {
  display: grid;
  gap: 8px;
  justify-items: start;
}
.summary-box {
  display: grid;
  gap: 6px;
}
.summary-box ul {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 3px;
}
.never-heading {
  margin-top: 4px;
}
.choices {
  display: grid;
  gap: 12px;
}
.choice-group {
  display: grid;
  gap: 8px;
}
.choice-title {
  display: block;
}
.block-hint {
  display: block;
  margin-top: 2px;
}
.privacy-warning {
  border-color: color-mix(in oklab, var(--warn) 45%, var(--edge));
}
.privacy-warning p {
  margin-top: 2px;
}
.link-field {
  gap: 6px;
}
.link-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.link-meta label {
  font-weight: 650;
  font-size: 13.5px;
}
.url-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}
.url-row .input {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12.5px;
}
.share-acts .stop-btn {
  margin-right: auto;
}
@media (max-width: 520px) {
  .url-row {
    flex-direction: column;
  }
  .share-acts .stop-btn {
    margin-right: 0;
  }
}
</style>
