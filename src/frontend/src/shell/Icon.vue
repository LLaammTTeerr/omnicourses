<script setup lang="ts">
import { ICONS, type IconName } from './icons.js';

defineProps<{ name: IconName; size?: 'sm' | 'lg' }>();
</script>

<template>
  <svg :class="['icon', size]" viewBox="0 0 24 24" aria-hidden="true" focusable="false" v-html="ICONS[name]" />
</template>
