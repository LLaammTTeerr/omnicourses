<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<template>
  <header class="bar"><strong>OmniCourse</strong></header>
  <main><RouterView /></main>
</template>

<style>
:root {
  font-family: system-ui, sans-serif;
  color: #1a1a1a;
  background: #fafafa;
}
body {
  margin: 0;
}
.bar {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e5e5;
}
main {
  padding: 16px;
}
</style>
