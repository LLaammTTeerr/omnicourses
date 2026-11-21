<script setup lang="ts">
import { useMessages } from '../locale.js';
import { COMMON_MESSAGES } from '../messages.js';
import Icon from '../shell/Icon.vue';

// A screen's data while it is not there: "loading", or a failure in plain words with a way to try again. Shared by
// every screen that loads, so each says it the same way; the failure's details are in the console (reportFailure).
// Attributes such as data-test go on the failure callout. The default slot replaces the words and the retry button,
// for a failure the screen says another way (a 404); the `actions` slot adds buttons after the retry.
defineOptions({ inheritAttrs: false });
withDefaults(
  defineProps<{
    status: 'loading' | 'loaded' | 'failed';
    /** The words while loading; none draws nothing. */
    loading?: string;
    failed: string;
    /** The retry button's words; "Try again" by default. */
    retry?: string;
    tone?: 'bad' | 'warn';
    small?: boolean;
  }>(),
  { loading: undefined, retry: undefined, tone: 'bad', small: false },
);
defineEmits<{ retry: [] }>();
const common = useMessages(COMMON_MESSAGES);
</script>

<template>
  <p v-if="status === 'loading' && loading" class="t3">{{ loading }}</p>
  <div v-else-if="status === 'failed'" :class="['callout', tone, { small }]" role="alert" v-bind="$attrs">
    <Icon name="alert" :size="small ? 'sm' : undefined" />
    <slot>
      <div>
        <p>{{ failed }}</p>
        <button class="btn sm" type="button" @click="$emit('retry')">{{ retry ?? common.retry }}</button>
        <slot name="actions" />
      </div>
    </slot>
  </div>
</template>
