<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useMessages } from '../locale.js';
import type { GuideLink } from './api.js';
import { GUIDE_MESSAGES } from './messages.js';

// A link inside a guide: an OmniCourse path stays in the app, anything else opens in a new tab.
defineProps<{ link: GuideLink }>();
const m = useMessages(GUIDE_MESSAGES);
</script>

<template>
  <RouterLink v-if="link.url.startsWith('/')" :to="link.url">{{ link.label }}</RouterLink>
  <a v-else :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.label }}<span class="sr-only">{{ m.newTab }}</span></a>
</template>
