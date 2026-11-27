<script setup lang="ts">
import { computed } from 'vue';
import { useMessages } from '../locale.js';
import { NOTIFICATION_MESSAGES } from './messages.js';
import { useUnread } from './store.js';

const BADGE_MAX = 99;

const unread = useUnread();
const m = useMessages(NOTIFICATION_MESSAGES);
const shown = computed(() => (unread.count > BADGE_MAX ? `${BADGE_MAX}+` : String(unread.count)));
</script>

<template>
  <span v-if="unread.count > 0" class="badge" data-test="unread-badge">
    <span aria-hidden="true">{{ shown }}</span><span class="sr-only">{{ m.badge(unread.count) }}</span>
  </span>
</template>

<style scoped>
.badge {
  min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--bad); color: #fff;
  font-size: 12px; font-weight: 650; display: inline-grid; place-items: center; line-height: 1; flex: none;
}
</style>
