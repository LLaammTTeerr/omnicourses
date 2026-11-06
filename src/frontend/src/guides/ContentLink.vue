<script setup lang="ts">
import { RouterLink } from 'vue-router';
import ExternalLink from '../components/ExternalLink.vue';
import type { GuideLink } from './api.js';

defineProps<{ link: GuideLink }>();
</script>

<template>
  <RouterLink v-if="link.url.startsWith('/')" :to="link.url">{{ link.label }}</RouterLink>
  <ExternalLink v-else :href="link.url">{{ link.label }}</ExternalLink>
</template>
