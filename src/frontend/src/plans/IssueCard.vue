<script setup lang="ts">
import { computed } from 'vue';
import { useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import type { IconName } from '../shell/icons.js';
import { REGULATION_URL } from '../shell/messages.js';
import type { PlanIssue } from './api.js';
import { clause, KIND_STYLE } from './issue-view.js';
import { PLANNER_MESSAGES } from './messages.js';

const props = defineProps<{
  issue: Pick<PlanIssue, 'code' | 'kind' | 'citation'>;
  text: string;
  place: string | null;
  icon?: IconName;
  variant: 'editor' | 'shared';
}>();
const m = useMessages(PLANNER_MESSAGES);
const article = computed(() => clause(props.issue.citation));
</script>

<template>
  <li :class="['vitem', issue.kind, `in-${variant}`]">
    <span class="ic" aria-hidden="true"><Icon :name="icon ?? KIND_STYLE[issue.kind].icon" size="sm" /></span>
    <div>
      <b><span class="sr-only">{{ m.kinds[issue.kind] }}: </span>{{ m.issueTitle[issue.code] }}</b>
      <p data-test="issue-text">{{ text }}</p>
      <div class="vfoot">
        <span v-if="place" class="chip line">{{ place }}</span>
        <a
          v-if="article"
          class="ref"
          :href="REGULATION_URL"
          target="_blank"
          rel="noopener noreferrer"
          :title="m.sourceTitle(issue.citation)"
          data-test="citation"
        ><Icon name="book" size="sm" /><span class="sr-only">{{ m.source }}: {{ issue.citation }}</span><span aria-hidden="true">{{ article }}</span></a>
        <span v-else class="chip line" data-test="citation">{{ issue.citation }}</span>
        <slot />
      </div>
    </div>
  </li>
</template>

<style scoped>
.vitem {
  display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 10px; padding: 10px 12px; border-radius: 12px;
  background: color-mix(in oklab, var(--bad) 5%, var(--surface)); border: 1px solid;
}
.vitem.in-editor { border-color: color-mix(in oklab, var(--bad) 22%, var(--edge)); transition: border-color 0.2s, background 0.2s, box-shadow 0.2s, opacity 0.2s; }
.vitem.in-shared { border-color: color-mix(in oklab, var(--bad) 24%, var(--edge)); }
.vitem .ic { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; background: var(--bad); color: #fff; }
.vitem b { display: block; font-size: 13.5px; line-height: 1.35; }
.vitem p { font-size: 12.5px; color: var(--ink-2); margin-top: 2px; }
.vitem.in-shared p { overflow-wrap: anywhere; }
.vfoot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
.vitem.flag { background: color-mix(in oklab, var(--warn) 6%, var(--surface)); }
.vitem.flag.in-editor { border-color: color-mix(in oklab, var(--warn) 26%, var(--edge)); }
.vitem.flag.in-shared { border-color: color-mix(in oklab, var(--warn) 28%, var(--edge)); }
.vitem.flag .ic { background: var(--warn); }
.vitem.in-editor.new { box-shadow: 0 0 0 2px color-mix(in oklab, var(--bad) 40%, transparent); }
.vitem.in-editor.gone { background: color-mix(in oklab, var(--ok) 6%, var(--surface)); border-color: color-mix(in oklab, var(--ok) 30%, var(--edge)); }
.vitem.gone .ic { background: var(--ok); }
.vitem.gone b { color: var(--ink-2); text-decoration: line-through; text-decoration-color: color-mix(in oklab, var(--ink-3) 60%, transparent); }
.ref {
  display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 650; text-decoration: none; padding: 1px 8px; border-radius: 999px;
  border: 1px solid var(--edge-strong); color: var(--ink-2); background: var(--surface);
}
.in-editor .ref { white-space: nowrap; }
.ref .icon { width: 13px; height: 13px; }
.in-editor .ref:hover { border-color: var(--ink-3); color: var(--ink); }
</style>
