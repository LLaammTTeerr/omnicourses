<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { statusOf } from '../api.js';
import { useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import type { AuditOutcome, DegreeAudit } from './api.js';
import { AUDIT_MESSAGES } from './messages.js';

// The states both audit screens share: loading, failed with a retry, no program or curriculum yet (409, ADR 0013),
// and the audit itself, with a note when no transcript is saved (UC-03 A1). A 401 shows nothing: the session is
// over, and App.vue is already taking the student to sign in.
const props = defineProps<{
  status: 'loading' | 'loaded' | 'failed';
  data: AuditOutcome | null;
  error: unknown;
}>();
defineEmits<{ retry: [] }>();
defineSlots<{ default(props: { audit: DegreeAudit }): unknown }>();
const m = useMessages(AUDIT_MESSAGES);

const audit = computed(() => (props.data?.status === 'ready' ? props.data.audit : null));
// Every transcript row has a term, so an audit with no term is one worked out from no transcript.
const noTranscript = computed(() => audit.value !== null && audit.value.terms.length === 0);
</script>

<template>
  <p v-if="status === 'loading'" class="t3" role="status">{{ m.loading }}</p>
  <template v-else-if="status === 'failed'">
    <div v-if="statusOf(error) !== 401" class="callout bad" role="alert" data-test="load-failed">
      <Icon name="alert" />
      <div>
        <p>{{ m.loadFailed }}</p>
        <button class="btn sm" type="button" @click="$emit('retry')">{{ m.retry }}</button>
      </div>
    </div>
  </template>
  <div v-else-if="data?.status === 'onboarding_required'" class="callout info" data-test="onboarding-required">
    <Icon name="info" />
    <div>
      <b>{{ m.onboardingRequired }}</b>
      <p>{{ m.onboardingRequiredText }}</p>
      <RouterLink class="btn sm primary" :to="{ name: 'onboarding' }">{{ m.finishOnboarding }}</RouterLink>
    </div>
  </div>
  <div v-else-if="data?.status === 'curriculum_not_found'" class="callout warn" data-test="curriculum-not-found">
    <Icon name="info" />
    <div>
      <b>{{ m.curriculumNotFound }}</b>
      <p>{{ m.curriculumNotFoundText }}</p>
      <RouterLink class="btn sm" :to="{ name: 'settings' }">{{ m.openSettings }}</RouterLink>
    </div>
  </div>
  <template v-else-if="audit">
    <div v-if="noTranscript" class="callout info" data-test="no-transcript">
      <Icon name="file" />
      <div>
        <b>{{ m.noTranscriptTitle }}</b>
        <p>{{ m.noTranscriptText }}</p>
        <RouterLink class="btn sm primary" :to="{ name: 'transcript' }">{{ m.enterTranscript }}</RouterLink>
      </div>
    </div>
    <slot :audit="audit" />
  </template>
</template>

<style scoped>
.callout .btn { margin-top: 10px; }
</style>
