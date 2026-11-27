<script setup lang="ts">
import type { CapState, Meter } from './issue-view.js';

defineProps<{ meter: Meter; cap: CapState; variant: 'editor' | 'shared' }>();
</script>

<template>
  <div :class="['cap', cap, `in-${variant}`]" aria-hidden="true">
    <span class="track">
      <i class="fill" :style="{ width: `${meter.fill}%` }" />
      <slot />
    </span>
    <span v-if="meter.min !== null" class="tick" :style="{ left: `${meter.min}%` }"><em>{{ meter.minLabel }}</em></span>
    <span class="tick max" :style="{ left: `${meter.max}%` }"><em>{{ meter.maxLabel }}</em></span>
  </div>
</template>

<style scoped>
.cap { position: relative; }
.cap.in-editor { padding-bottom: 16px; margin-top: 2px; }
.cap.in-shared { padding-bottom: 14px; }
.cap .track { display: block; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
.cap.in-editor .track { position: relative; height: 8px; }
.cap.in-shared .track { height: 6px; }
.cap .fill { border-radius: 999px; }
.cap.in-editor .fill {
  position: absolute; top: 0; bottom: 0; left: 0; background: var(--ink-3);
  transition: width 0.34s cubic-bezier(0.2, 0.8, 0.2, 1), left 0.34s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 0.25s;
  animation: grow 0.7s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.cap.in-shared .fill { display: block; height: 100%; background: var(--info); }
.cap.ok .fill { background: var(--ok); }
.cap.under .fill { background: var(--warn); }
.cap.over .fill { background: var(--bad); }
.cap .tick { position: absolute; }
.cap.in-editor .tick { top: -3px; width: 2px; height: 14px; margin-left: -1px; border-radius: 2px; background: var(--edge-strong); }
.cap.in-editor .tick.max { background: var(--ink-3); }
.cap.in-editor .tick em { position: absolute; top: 15px; left: 50%; transform: translateX(-50%); font: 600 10.5px var(--font); font-style: normal; color: var(--ink-3); }
.cap.in-shared .tick { top: 0; transform: translateX(-50%); }
.cap.in-shared .tick::before { content: ''; display: block; width: 2px; height: 8px; background: var(--ink-3); margin: -1px auto 0; }
.cap.in-shared .tick em { display: block; font: 600 10.5px var(--mono); color: var(--ink-3); margin-top: 1px; }
@keyframes grow { from { width: 0; } }
</style>
