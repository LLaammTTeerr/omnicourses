<script setup lang="ts">
import { useMessages } from '../locale.js';

defineProps<{ href: string }>();
const m = useMessages({ vi: { newTab: ' (mở ở tab mới)' }, en: { newTab: ' (opens in a new tab)' } });
</script>

<template>
  <a :href="href" target="_blank" rel="noopener noreferrer"><slot /><span class="sr-only">{{ m.newTab }}</span></a>
</template>
