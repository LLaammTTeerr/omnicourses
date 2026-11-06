<script setup lang="ts">
import { useMessages } from '../locale.js';
import { GUIDE_MESSAGES } from './messages.js';

defineEmits<{ retry: [] }>();
const m = useMessages(GUIDE_MESSAGES);
</script>

<template>
  <p role="alert">
    {{ m.loadFailed }} <button type="button" @click="$emit('retry')">{{ m.retry }}</button>
  </p>
</template>
