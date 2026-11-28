<script setup lang="ts">
import { computed } from 'vue';
import { useMessages } from '../locale.js';

const props = defineProps<{ href: string }>();
const m = useMessages({ vi: { newTab: ' (mở ở tab mới)' }, en: { newTab: ' (opens in a new tab)' } });
const safe = computed(() => !/[\u0000-\u0020\u007f]/.test(props.href) && /^(?:https?:\/\/.+|\/(?![/\\]).*)/i.test(props.href));
</script>

<template>
  <a v-if="safe" :href="href" target="_blank" rel="noopener noreferrer"><slot /><span class="sr-only">{{ m.newTab }}</span></a>
  <span v-else class="link" aria-disabled="true"><slot /></span>
</template>
