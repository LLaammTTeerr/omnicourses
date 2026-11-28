<script setup lang="ts">
import { useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { ADMIN_MESSAGES } from './messages.js';
import type { ProblemView } from './problem.js';

defineProps<{ problem: ProblemView | null }>();
defineEmits<{ reload: [] }>();
const m = useMessages(ADMIN_MESSAGES);
</script>

<template>
  <div v-if="problem" class="callout small admin-problem" :class="problem.tone" role="alert" data-test="admin-problem" :data-code="problem.code">
    <Icon name="alert" size="sm" />
    <div>
      <p>{{ problem.text }}</p>
      <template v-if="problem.items.length">
        <p v-if="problem.serverText" class="t2">{{ m.problem.serverAnswered }}</p>
        <ul>
          <li v-for="item in problem.items" :key="item" :lang="problem.serverText ? 'en' : undefined">{{ item }}</li>
        </ul>
      </template>
      <button v-if="problem.reload" class="btn sm" type="button" data-test="admin-reload" @click="$emit('reload')">{{ m.reload }}</button>
    </div>
  </div>
</template>

<style scoped>
.admin-problem > div { display: grid; gap: 6px; min-width: 0; justify-items: start; }
.admin-problem ul { margin: 0; padding-left: 18px; display: grid; gap: 2px; }
.admin-problem li { overflow-wrap: anywhere; }
</style>
