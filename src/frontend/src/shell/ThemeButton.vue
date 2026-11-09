<script setup lang="ts">
import { computed } from 'vue';
import { useMessages } from '../locale.js';
import Icon from './Icon.vue';
import { SHELL_MESSAGES } from './messages.js';
import { useTheme } from './theme.js';

// Names the theme it switches to (UI prototypes). `iconOnly` keeps the name for screen readers and the tooltip.
defineProps<{ iconOnly?: boolean }>();
const theme = useTheme();
const m = useMessages(SHELL_MESSAGES);
const next = computed(() => (theme.theme === 'dark' ? m.value.toLight : m.value.toDark));
</script>

<template>
  <button type="button" class="theme-btn" :aria-label="iconOnly ? next : undefined" :title="iconOnly ? next : undefined" @click="theme.toggle()">
    <span class="ico"><Icon :name="theme.theme === 'dark' ? 'sun' : 'moon'" /></span>
    <span v-if="!iconOnly" class="tx">{{ next }}</span>
  </button>
</template>
