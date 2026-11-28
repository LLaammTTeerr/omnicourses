<script setup lang="ts">
import { useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import type { PlanIssueKind } from './api.js';
import { ISSUE_KINDS_SHOWN, KIND_STYLE } from './issue-view.js';
import { PLANNER_MESSAGES } from './messages.js';

defineProps<{ count: (kind: PlanIssueKind) => number }>();
const m = useMessages(PLANNER_MESSAGES);
</script>

<template>
  <div class="issue-counts" data-test="issue-counts">
    <span v-for="kind in ISSUE_KINDS_SHOWN" :key="kind" :class="['chip', KIND_STYLE[kind].tone]">
      <Icon :name="KIND_STYLE[kind].icon" size="sm" />{{ m.kindsPlural[kind](count(kind)) }}
    </span>
  </div>
</template>

<style scoped>
.issue-counts { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
