<script setup lang="ts">
import Icon from '../shell/Icon.vue';

defineProps<{ items: { text: string; place: string }[] }>();
</script>

<template>
  <ul class="unknown-list">
    <li v-for="(item, i) in items" :key="i" data-test="issue-unknown">
      <Icon name="info" size="sm" />
      <span>{{ item.text }} <span class="t3">· {{ item.place }}</span></span>
    </li>
  </ul>
</template>

<style scoped>
.unknown-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 12.5px; color: var(--ink-2); }
.unknown-list li { display: flex; gap: 6px; align-items: flex-start; }
.unknown-list .icon { flex: none; width: 14px; height: 14px; margin-top: 2px; color: var(--ink-3); }
</style>
