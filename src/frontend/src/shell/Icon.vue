<script setup lang="ts">
import { ICONS, type IconName } from './icons.js';

// Decorative: the text next to an icon, or the button's label, names it.
defineProps<{ name: IconName; size?: 'sm' | 'lg' }>();
</script>

<template>
  <!-- The paths are constants from icons.ts, never user content. -->
  <svg :class="['icon', size]" viewBox="0 0 24 24" aria-hidden="true" focusable="false" v-html="ICONS[name]" />
</template>
