<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router';

// The logo: four rounded squares in four group colours, then the name.
defineProps<{ to: RouteLocationRaw }>();
</script>

<template>
  <RouterLink class="brand" :to="to">
    <svg class="logo" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="17" height="17" rx="5" fill="var(--core)" />
      <rect x="21" y="2" width="17" height="17" rx="8.5" fill="var(--phys)" />
      <rect x="2" y="21" width="17" height="17" rx="8.5" fill="var(--pol)" />
      <rect x="21" y="21" width="17" height="17" rx="5" fill="var(--elec)" />
    </svg>
    <b class="name">OmniCourse</b>
  </RouterLink>
</template>

<style>
.brand { display: flex; align-items: center; gap: 10px; text-decoration: none; min-width: 0; }
.brand .name { font-weight: 700; font-size: 17px; letter-spacing: -0.02em; white-space: nowrap; }
.logo { width: 28px; height: 28px; flex: none; }
</style>
