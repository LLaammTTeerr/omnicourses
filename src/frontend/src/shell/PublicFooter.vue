<script setup lang="ts">
import { RouterLink } from 'vue-router';
import ExternalLink from '../components/ExternalLink.vue';
import { useMessages } from '../locale.js';
import { REGULATION_URL, SHELL_MESSAGES } from './messages.js';

const m = useMessages(SHELL_MESSAGES);
const guides = useMessages({ vi: 'Hướng dẫn', en: 'Guides' });
const privacy = useMessages({ vi: 'Quyền riêng tư', en: 'Privacy' });
</script>

<template>
  <footer class="pub-foot">
    <span>{{ m.footer }}</span>
    <span>
      <RouterLink :to="{ name: 'guides' }">{{ guides }}</RouterLink> ·
      <RouterLink :to="{ name: 'privacy' }">{{ privacy }}</RouterLink> ·
      <ExternalLink :href="REGULATION_URL">{{ m.regulation }}</ExternalLink>
    </span>
  </footer>
</template>

<style>
.pub-foot {
  border-top: 1px solid var(--edge); padding: 28px clamp(16px, 4vw, 48px) 48px; display: flex; gap: 12px 20px; flex-wrap: wrap;
  justify-content: space-between; font-size: 13.5px; color: var(--ink-3); background: var(--surface);
}
.pub-foot a { color: var(--ink-2); }
</style>
