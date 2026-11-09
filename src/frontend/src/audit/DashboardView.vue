<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { groupClass } from '../groups.js';
import { useLocale, useMessages } from '../locale.js';
import { usePageTitle } from '../page-title.js';
import Icon from '../shell/Icon.vue';
import type { DegreeAudit } from './api.js';
import AuditGate from './AuditGate.vue';
import { AUDIT_MESSAGES } from './messages.js';
import { combinedNamesOf, conditionAnchor, conditionLabel, formatScore, share, shownGroups, useAudit } from './present.js';

// The dashboard (F3, UC-03; UI prototypes: dashboard.html), where a signed-in student lands: graduation status,
// credits, each requirement group's progress, the conditions not met yet, and the way on. Every figure is the
// degree audit API's (ADR 0013); the page draws and words them, and decides none (AGENTS.md hard rule 1).
const locale = useLocale();
const router = useRouter();
const m = useMessages(AUDIT_MESSAGES);
const { status, data, error, reload } = useAudit();
const audit = computed(() => (data.value?.status === 'ready' ? data.value.audit : null));

/** How many unmet conditions the dashboard lists before sending the student to the audit page. */
const TOP_UNMET = 5;

// TODO(F5): the planner screen is being built on `feat/ui-planner`. Until its route (named `planner`) exists, the
// link shows as coming soon instead of leading nowhere.
const hasPlanner = computed(() => router.hasRoute('planner'));

const score = (value: number | null) => formatScore(value, locale.lang) ?? m.value.noGrade;
const unmet = (a: DegreeAudit) => a.graduation.unmet.slice(0, TOP_UNMET);

usePageTitle(() => m.value.dashboardTitle);
</script>

<template>
  <div class="page dashboard-page">
    <header class="page-head">
      <div>
        <h1>{{ m.dashboardTitle }}</h1>
        <p v-if="audit" data-test="who">{{ m.curriculum(audit.curriculumCode, audit.credits.yearLevel) }}</p>
      </div>
    </header>

    <AuditGate :status="status" :data="data" :error="error" @retry="reload">
      <template #default="{ audit: a }">
        <section class="card db-top" :aria-label="m.graduation">
          <div class="db-stat" data-test="graduation">
            <span class="label">{{ m.graduation }}</span>
            <span :class="['chip', a.graduation.status === 'done' ? 'ok' : 'warn']">
              <Icon :name="a.graduation.status === 'done' ? 'check' : 'alert'" size="sm" />
              {{ a.graduation.status === 'done' ? m.graduationDone : m.graduationNotYet }}
            </span>
            <p class="small t2">
              {{ a.graduation.status === 'done' ? m.graduationDoneText(a.graduation.notChecked.length) : m.graduationNotYetText(a.graduation.unmet.length) }}
            </p>
          </div>
          <div class="db-stat" data-test="credits">
            <span class="label">{{ m.creditsTitle }}</span>
            <b class="big">{{ m.creditsOf(a.credits.towardTotal, a.credits.totalRequired) }}</b>
            <div
              v-if="a.credits.totalRequired !== null"
              class="meter split"
              role="img"
              :aria-label="`${m.creditsOf(a.credits.towardTotal, a.credits.totalRequired)}, ${m.inProgress(a.credits.inProgressTowardTotal)}`"
            >
              <i class="passed" :style="{ width: `${share(a.credits.towardTotal, a.credits.totalRequired)}%` }"></i>
              <i class="current" :style="{ width: `${share(a.credits.inProgressTowardTotal, a.credits.totalRequired)}%` }"></i>
            </div>
            <p class="small t2">
              <template v-if="a.credits.remaining !== null">{{ m.remaining(a.credits.remaining) }} · </template>
              <template v-else>{{ m.totalNotRecorded }} </template>
              {{ m.inProgress(a.credits.inProgressTowardTotal) }} · <span :title="m.accumulatedHint">{{ m.accumulated(a.credits.accumulated) }}</span>
            </p>
          </div>
          <div class="db-stat" data-test="gpa">
            <span class="label">{{ m.accumulatedAverage }}</span>
            <b class="big">{{ score(a.gpa.accumulatedAverage) }}</b>
            <p class="small t2">
              <template v-if="a.gpa.classification">{{ m.classification }}: {{ m.classifications[a.gpa.classification] }} · </template>
              {{ m.average }}: {{ score(a.gpa.average) }}
            </p>
          </div>
        </section>

        <div class="db-main">
          <section class="card" aria-labelledby="db-groups-title">
            <div class="db-sec-head">
              <h2 id="db-groups-title">{{ m.groupsTitle }}</h2>
              <ul class="legend small t2" aria-hidden="true">
                <li><i class="passed"></i>{{ m.legendPassed }}</li>
                <li><i class="overflow"></i>{{ m.legendOverflow }}</li>
                <li><i class="current"></i>{{ m.legendInProgress }}</li>
              </ul>
            </div>
            <ul class="db-groups">
              <li v-for="{ group, colour, glyph } in shownGroups(a)" :key="group.id" :class="groupClass(colour)" data-test="group">
                <RouterLink class="db-g" :to="{ name: 'audit', hash: `#group-${group.id}` }">
                  <span class="glyph sm" aria-hidden="true">{{ glyph }}</span>
                  <span class="db-g-body">
                    <span class="db-g-top">
                      <b class="nm">{{ group.name }}</b>
                      <span class="fig">
                        <template v-if="group.requiredCredits !== null">{{ m.groupCredits(group.passedCredits, group.requiredCredits) }}</template>
                        <template v-else>{{ m.creditsShort(group.passedCredits) }}</template>
                      </span>
                    </span>
                    <span v-if="group.requiredCredits !== null" class="meter split" aria-hidden="true">
                      <i class="passed" :style="{ width: `${share(group.passedCredits, group.requiredCredits)}%` }"></i>
                      <i class="overflow" :style="{ width: `${share(group.overflowInCredits, group.requiredCredits)}%` }"></i>
                      <i class="current" :style="{ width: `${share(group.inProgressCredits, group.requiredCredits)}%` }"></i>
                    </span>
                    <span class="small t3 db-g-note">
                      <span :class="['state', group.met ? 'ok' : 'todo']">{{ group.met ? `✓ ${m.met}` : `○ ${m.notMet}` }}</span>
                      <template v-if="group.requiredCredits === null">
                        · {{ combinedNamesOf(a, group.id).length ? m.noMinimumIn(combinedNamesOf(a, group.id).join(', ')) : m.noMinimum }}
                      </template>
                      <template v-else-if="group.remainingCredits">· {{ m.remaining(group.remainingCredits) }}</template>
                      <template v-if="group.inProgressCredits">· {{ m.inProgress(group.inProgressCredits) }}</template>
                      <template v-if="group.overflowInCredits">· {{ m.overflowIn(group.overflowInCredits) }}</template>
                    </span>
                  </span>
                </RouterLink>
              </li>
              <li v-for="combined in a.combinedMinimums" :key="combined.id" data-test="combined">
                <RouterLink class="db-g" :to="{ name: 'audit', hash: `#combined-${combined.id}` }">
                  <span class="glyph sm combined" aria-hidden="true">+</span>
                  <span class="db-g-body">
                    <span class="db-g-top">
                      <b class="nm">{{ combined.name }}</b>
                      <span class="fig">{{ m.combinedCredits(combined.credits, combined.creditsMin) }}</span>
                    </span>
                    <span class="meter split" aria-hidden="true">
                      <i class="passed" :style="{ width: `${share(combined.credits, combined.creditsMin)}%` }"></i>
                      <i class="current" :style="{ width: `${share(combined.inProgressCredits, combined.creditsMin)}%` }"></i>
                    </span>
                    <span class="small t3 db-g-note">
                      <span :class="['state', combined.met ? 'ok' : 'todo']">{{ combined.met ? `✓ ${m.met}` : `○ ${m.notMet}` }}</span>
                      <template v-if="combined.remainingCredits">· {{ m.remaining(combined.remainingCredits) }}</template>
                      <template v-if="combined.inProgressCredits">· {{ m.inProgress(combined.inProgressCredits) }}</template>
                    </span>
                  </span>
                </RouterLink>
              </li>
            </ul>
          </section>

          <div class="db-aside">
            <section class="card" aria-labelledby="db-unmet-title" data-test="unmet">
              <div class="db-sec-head">
                <h2 id="db-unmet-title">{{ m.attentionTitle }}</h2>
                <RouterLink class="link small" :to="{ name: 'audit' }">{{ m.seeAudit }}</RouterLink>
              </div>
              <p v-if="a.graduation.unmet.length === 0" class="small t2">{{ m.attentionNone }}</p>
              <ul v-else class="db-unmet">
                <li v-for="condition in unmet(a)" :key="condition.id">
                  <RouterLink :to="{ name: 'audit', hash: conditionAnchor(condition) }">
                    <span class="nm">{{ conditionLabel(a, condition, m) }}</span>
                    <span class="cite small t3">{{ condition.citation }}</span>
                  </RouterLink>
                </li>
              </ul>
              <p v-if="a.graduation.unmet.length > TOP_UNMET" class="small t3">{{ m.attentionMore(a.graduation.unmet.length - TOP_UNMET) }}</p>
            </section>

            <nav class="card db-next" aria-labelledby="db-next-title">
              <h2 id="db-next-title">{{ m.nextTitle }}</h2>
              <RouterLink class="db-link" :to="{ name: 'audit' }" data-test="link-audit">
                <Icon name="check" /><span><b>{{ m.openAudit }}</b><small>{{ m.openAuditText }}</small></span>
              </RouterLink>
              <RouterLink class="db-link" :to="{ name: 'transcript' }" data-test="link-transcript">
                <Icon name="file" /><span><b>{{ m.openTranscript }}</b><small>{{ m.openTranscriptText }}</small></span>
              </RouterLink>
              <RouterLink class="db-link" :to="{ name: 'explorer' }" data-test="link-explorer">
                <Icon name="graph" /><span><b>{{ m.openExplorer }}</b><small>{{ m.openExplorerText }}</small></span>
              </RouterLink>
              <RouterLink v-if="hasPlanner" class="db-link" :to="{ name: 'planner' }" data-test="link-planner">
                <Icon name="cap" /><span><b>{{ m.openPlanner }}</b><small>{{ m.openPlannerText }}</small></span>
              </RouterLink>
              <span v-else class="db-link soon" data-test="link-planner" aria-disabled="true">
                <Icon name="cap" /><span><b>{{ m.openPlanner }} <span class="chip">{{ m.soon }}</span></b><small>{{ m.openPlannerText }}</small></span>
              </span>
            </nav>
          </div>
        </div>

        <p class="small t3">{{ m.engineNote }}</p>
      </template>
    </AuditGate>
  </div>
</template>

<style>
.dashboard-page .db-top { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; }
.db-stat { display: grid; gap: 8px; align-content: start; min-width: 0; }
.db-stat .label { font-size: 13px; font-weight: 650; color: var(--ink-3); }
.db-stat .big { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
.db-stat .chip { white-space: normal; min-height: 30px; padding: 4px 12px; justify-self: start; }
.meter.split { display: flex; }
.meter.split > i { flex: none; }
.legend { --c: var(--ink-3); }
.meter .passed, .legend .passed { background: var(--c, var(--acc)); }
.meter .overflow, .legend .overflow { background: color-mix(in oklab, var(--c, var(--acc)) 55%, var(--surface)); }
.meter .current, .legend .current {
  background: repeating-linear-gradient(45deg, color-mix(in oklab, var(--c, var(--acc)) 45%, var(--surface)) 0 4px, var(--surface-3) 4px 8px);
}
.db-main { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 22px; align-items: start; }
.db-aside { display: grid; gap: 22px; min-width: 0; }
.db-sec-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.legend { list-style: none; margin: 0; padding: 0; display: flex; gap: 12px; flex-wrap: wrap; }
.legend li { display: inline-flex; align-items: center; gap: 6px; }
.legend i { display: inline-block; width: 14px; height: 8px; border-radius: 4px; }
.db-groups, .db-unmet { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.db-g { display: flex; gap: 12px; align-items: flex-start; padding: 10px; margin: 0 -10px; border-radius: 10px; text-decoration: none; color: inherit; }
.db-g:hover { background: var(--surface-2); }
.db-g .glyph.combined { background: var(--surface-3); color: var(--ink-2); }
.db-g-body { display: grid; gap: 6px; flex: 1; min-width: 0; }
.db-g-top { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
.db-g-top .nm { font-size: 14px; overflow-wrap: anywhere; }
.db-g-top .fig { font-size: 13px; font-weight: 650; white-space: nowrap; color: var(--ink-2); }
.db-g-note .state { font-weight: 650; }
.db-g-note .state.ok { color: color-mix(in oklab, var(--ok) 80%, var(--ink)); }
.db-unmet a { display: grid; gap: 2px; padding: 8px 10px; margin: 0 -10px; border-radius: 10px; text-decoration: none; color: inherit; }
.db-unmet a:hover { background: var(--surface-2); }
.db-unmet .nm { font-weight: 600; font-size: 14px; overflow-wrap: anywhere; }
.db-next { display: grid; gap: 4px; }
.db-next h2 { margin-bottom: 8px; }
.db-link { display: flex; gap: 12px; align-items: flex-start; padding: 10px; margin: 0 -10px; border-radius: 10px; text-decoration: none; color: inherit; }
a.db-link:hover { background: var(--surface-2); }
.db-link > .icon { color: var(--ink-3); margin-top: 2px; }
.db-link > span { display: grid; gap: 2px; min-width: 0; }
.db-link b { font-size: 14px; display: inline-flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.db-link small { color: var(--ink-3); font-size: 12.5px; }
.db-link.soon { opacity: 0.7; }
@media (max-width: 1100px) {
  .db-main { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 760px) {
  .dashboard-page .db-top { grid-template-columns: minmax(0, 1fr); }
}
</style>
