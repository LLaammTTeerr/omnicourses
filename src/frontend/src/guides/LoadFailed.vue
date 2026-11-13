<script setup lang="ts">
import { useMessages } from '../locale.js';
import { COMMON_MESSAGES } from '../messages.js';
import { GUIDE_MESSAGES } from './messages.js';

defineEmits<{ retry: [] }>();
const m = useMessages(GUIDE_MESSAGES);
const common = useMessages(COMMON_MESSAGES);
</script>

<template>
  <p class="callout bad" role="alert">
    {{ m.loadFailed }} <button class="btn sm" type="button" @click="$emit('retry')">{{ common.retry }}</button>
  </p>
</template>
