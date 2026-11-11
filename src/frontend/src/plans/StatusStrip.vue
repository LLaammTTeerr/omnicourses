<script setup lang="ts">
import { computed } from 'vue';
import { groupColour } from '../curriculum/present.js';
import { GROUPS, groupClass } from '../groups.js';
import { useLocale, useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { termName } from '../terms.js';
import type { PlanGroupCoverage } from './api.js';
import type { AttachedIssues } from './board.js';
import { PLANNER_MESSAGES } from './messages.js';

// The plan at a glance (the prototype's status strip): whether the rule engine finds a violation in a term, the term
// the plan ends in when the engine says every checkable requirement would be met, each requirement group's credits
// with the plan completed, and the save state. Every figure is read from the engine's report; nothing is judged here.
const props = defineProps<{
  attached: AttachedIssues | null;
  fresh: boolean;
  saveState: 'saved' | 'saving' | 'failed';
}>();
const locale = useLocale();
const m = useMessages(PLANNER_MESSAGES);

const report = computed(() => props.attached?.report ?? null);
/** Violations about a term or a course. Coverage shortfalls show in the groups beside. */
const placementViolations = computed(() => report.value?.issues.filter((i) => i.kind === 'violation' && i.term !== null).length ?? 0);
const lastTerm = computed(() => {
  const filled = props.attached?.board.filter((row) => row.tiles.length > 0) ?? [];
  return filled.at(-1)?.term ?? null;
});
/** The engine finds every checkable requirement met and no violation in a term; the plan then ends in its last term. */
const graduates = computed(() => report.value?.coverage.graduation === 'done' && placementViolations.value === 0);
const glyphOf = (group: Pick<PlanGroupCoverage, 'name' | 'kind'>) => {
  const colour = groupColour(group);
  return { colour, glyph: GROUPS.find((g) => g.id === colour)!.glyph };
};
</script>

<template>
  <section class="card status-strip" :aria-label="m.statusLabel" data-test="status-strip">
    <div v-if="report" class="est" :class="{ bad: !graduates, stale: !fresh }" data-test="estimate">
      <span class="est-ic" aria-hidden="true"><Icon :name="graduates ? 'cap' : 'alert'" /></span>
      <div>
        <small>{{ placementViolations ? m.invalid(placementViolations) : m.valid }}</small>
        <b v-if="graduates && lastTerm">{{ m.expectedGraduation }}: {{ termName(lastTerm, locale.lang) }}</b>
        <b v-else-if="graduates">{{ m.graduation.done }}</b>
        <b v-else>{{ m.notYetGraduation }}</b>
      </div>
    </div>
    <ul v-if="report" class="cov" :class="{ stale: !fresh }" data-test="strip-coverage">
      <li
        v-for="g in report.coverage.groups"
        :key="g.id"
        :class="[groupClass(glyphOf(g).colour), { miss: !g.met }]"
        :title="m.coverageTitle(g.name, g.credits, g.requiredCredits)"
        data-test="strip-group"
      >
        <span class="glyph sm" aria-hidden="true">{{ glyphOf(g).glyph }}</span>
        <span class="sr-only">{{ m.coverageTitle(g.name, g.credits, g.requiredCredits) }}</span>
        <span aria-hidden="true"><b class="num">{{ g.credits }}</b><template v-if="g.requiredCredits !== null">/{{ g.requiredCredits }}</template></span>
      </li>
    </ul>
    <span class="chip" :class="{ bad: saveState === 'failed', ok: saveState === 'saved' }" role="status" data-test="save-state">
      <Icon :name="saveState === 'failed' ? 'alert' : saveState === 'saved' ? 'check' : 'info'" size="sm" />
      {{ saveState === 'saving' ? m.saving : saveState === 'saved' ? m.saved : m.notSaved }}
    </span>
  </section>
</template>

<style>
.status-strip { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 18px; align-items: center; padding: 14px 18px; }
.status-strip .est { display: flex; gap: 12px; align-items: center; }
.status-strip .est-ic { width: 46px; height: 46px; flex: none; border-radius: 14px; display: grid; place-items: center; background: var(--ok); color: #fff; border: 1px solid var(--edge); transition: background 0.25s; }
.status-strip .est.bad .est-ic { background: var(--bad); }
.status-strip .est b { font: 700 20px var(--display); display: block; letter-spacing: -0.02em; }
.status-strip .est small { font-size: 12.5px; color: var(--ink-3); }
.status-strip .cov { list-style: none; margin: 0; padding: 0; display: flex; gap: 8px; flex-wrap: wrap; }
.status-strip .cov li {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px 4px 4px; border-radius: 10px; background: var(--surface-2);
  font-size: 12.5px; font-weight: 650; font-variant-numeric: tabular-nums; cursor: default; transition: background 0.2s, color 0.2s;
}
.status-strip .cov li.miss { background: color-mix(in oklab, var(--bad) 14%, var(--surface)); color: color-mix(in oklab, var(--bad) 80%, var(--ink)); }
.status-strip .num { font-weight: 750; }
.status-strip .stale { opacity: 0.55; }
@media (max-width: 900px) { .status-strip { grid-template-columns: 1fr; } .status-strip > .chip { justify-self: start; } }
</style>
