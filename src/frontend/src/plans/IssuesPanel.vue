<script setup lang="ts">
import { computed } from 'vue';
import { useLocale, useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { termKey, termName } from '../terms.js';
import type { PlanIssue, PlanIssueKind } from './api.js';
import type { AttachedIssues } from './board.js';
import IssueCard from './IssueCard.vue';
import IssueCounts from './IssueCounts.vue';
import { KIND_STYLE } from './issue-view.js';
import { PLANNER_MESSAGES, type IssueContext } from './messages.js';
import UnknownIssueList from './UnknownIssueList.vue';

const props = defineProps<{
  attached: AttachedIssues | null;
  status: 'loading' | 'failed' | 'idle';
  fresh: boolean;
  ctx: IssueContext;
  collapsed: boolean;
  preview: { label: string; attached: AttachedIssues | null } | null;
}>();
const emit = defineEmits<{ retry: []; focusTile: [key: number]; toggle: [] }>();
const locale = useLocale();
const m = useMessages(PLANNER_MESSAGES);

const issues = computed(() => props.attached?.report.issues ?? []);
const placed = computed(() => issues.value.filter((issue) => issue.term !== null));
const ofKind = (kind: PlanIssueKind) => placed.value.filter((issue) => issue.kind === kind);
const coverage = computed(() => props.attached?.report.coverage ?? null);
const short = computed(() => [...(coverage.value?.groups ?? []), ...(coverage.value?.combinedMinimums ?? [])].filter((g) => !g.met).length);
const unknownItems = computed(() =>
  ofKind('unknown').map((issue) => ({ text: m.value.issue[issue.code](issue, props.ctx), place: issue.term ? termName(issue.term, locale.lang) : m.value.wholePlan })),
);
const tileOf = (issue: PlanIssue) => props.attached?.tileOf.get(issue);

const idOf = (i: PlanIssue) => [i.code, i.courseCode ?? '', i.term ? termKey(i.term) : '', i.requirementGroupId ?? ''].join('|');
const listed = (a: AttachedIssues | null | undefined) => a?.report.issues.filter((i) => (i.kind === 'violation' || i.kind === 'flag') && i.term !== null) ?? [];
const violationsOf = (a: AttachedIssues | null | undefined) => listed(a).filter((i) => i.kind === 'violation');

const cards = computed(() => {
  const next = props.preview?.attached;
  const now = listed(props.attached);
  if (!next) return now.map((issue) => ({ issue, state: '' as const, id: idOf(issue) }));
  const nowIds = new Set(now.map(idOf));
  const nextIds = new Set(listed(next).map(idOf));
  return [
    ...listed(next).map((issue) => ({ issue, state: nowIds.has(idOf(issue)) ? ('' as const) : ('new' as const), id: idOf(issue) })),
    ...now.filter((i) => !nextIds.has(idOf(i))).map((issue) => ({ issue, state: 'gone' as const, id: `${idOf(issue)}|gone` })),
  ];
});
const previewNew = computed(() => cards.value.filter((c) => c.state === 'new' && c.issue.kind === 'violation'));
const previewDelta = computed(() => (props.preview?.attached ? violationsOf(props.preview.attached).length - violationsOf(props.attached).length : null));
const count = computed(() => violationsOf(props.preview?.attached ?? props.attached).length);

function onRailClick(e: MouseEvent): void {
  if (props.collapsed && !(e.target as Element).closest('[data-test="issues-toggle"]')) emit('toggle');
}
const icon = (c: { issue: PlanIssue; state: string }) => (c.state === 'gone' ? 'check' : KIND_STYLE[c.issue.kind].icon);
</script>

<template>
  <aside class="card issues-panel rail" :class="{ mini: collapsed, previewing: !!preview }" aria-labelledby="issues-title" :aria-busy="status === 'loading'" data-test="issues-panel" @click="onRailClick">
    <div class="rail-head">
      <button
        class="rail-toggle"
        type="button"
        :aria-expanded="!collapsed"
        aria-controls="issues-body"
        :aria-label="collapsed ? m.expand : m.collapse"
        :title="collapsed ? m.expand : m.collapse"
        data-test="issues-toggle"
        @click="emit('toggle')"
      >
        <Icon name="panel" size="sm" />
      </button>
      <h2 id="issues-title">{{ m.issuesTitle }}</h2>
      <span v-if="status === 'loading' && !attached" class="chip" role="status" data-test="checking">{{ m.checking }}</span>
      <span v-else-if="attached" :key="count" class="rail-n" :class="{ zero: count === 0 }" :title="m.kindsPlural.violation(count)" data-test="issues-mini-count">{{ count }}</span>
    </div>
    <div v-show="!collapsed" id="issues-body" class="rail-body">
      <p class="rail-sub">
        <template v-if="preview">
          <span class="live" aria-hidden="true" />
          <span role="status" data-test="issues-preview">{{ preview.label }} · {{ previewDelta !== null ? m.previewDelta(previewDelta) : m.dropChecking }}<span class="sr-only"><span v-for="c in previewNew" :key="c.id" data-test="preview-new">{{ m.issueTitle[c.issue.code] }}{{ m.issue[c.issue.code](c.issue, ctx) }}</span></span></span>
        </template>
        <template v-else-if="status === 'loading' && attached"><span class="live" aria-hidden="true" /><span role="status" data-test="checking">{{ m.checking }}</span></template>
        <template v-else>{{ m.issuesLead }}</template>
      </p>

      <div v-if="status === 'failed'" class="callout bad small" role="alert" data-test="issues-failed">
        <Icon name="alert" size="sm" />
        <div>
          <p>{{ m.checkFailed }}</p>
          <button class="btn sm" type="button" @click="emit('retry')">{{ m.retry }}</button>
        </div>
      </div>

      <template v-if="attached">
        <IssueCounts :class="{ stale: !fresh }" :count="(kind) => ofKind(kind).length" />

        <TransitionGroup v-if="cards.length" tag="ul" name="v" class="rail-list" :class="{ stale: !fresh && !preview }">
          <IssueCard
            v-for="c in cards"
            :key="c.id"
            :class="c.state"
            :issue="c.issue"
            :text="m.issue[c.issue.code](c.issue, ctx)"
            :place="c.issue.term ? termName(c.issue.term, locale.lang) : null"
            :icon="icon(c)"
            variant="editor"
            :data-test="c.state === 'gone' ? 'issue-gone' : `issue-${c.issue.kind}`"
          >
            <span v-if="c.state === 'new'" class="tag">{{ m.newTag }}</span>
            <span v-else-if="c.state === 'gone'" class="tag ok">{{ m.goneTag }}</span>
            <button
              v-if="!preview && tileOf(c.issue) !== undefined"
              class="btn sm"
              type="button"
              data-test="go-to"
              @click="emit('focusTile', tileOf(c.issue)!)"
            >
              {{ m.goTo }}<Icon name="right" size="sm" />
            </button>
          </IssueCard>
        </TransitionGroup>
        <div v-else class="rail-empty" :class="{ open: short > 0 }" data-test="no-issues">
          <Icon :name="short ? 'info' : 'check'" />
          <b>{{ short ? m.noTermViolations : m.noIssuesTitle }}</b>
          <span>{{ short ? m.groupsStillShort(short) : ofKind('unknown').length ? m.unknownsLeft(ofKind('unknown').length) : m.noIssues }}</span>
        </div>

        <details v-if="ofKind('unknown').length" class="unknowns" :class="{ stale: !fresh }" data-test="unknowns">
          <summary>{{ m.kindHeadings.unknown }} ({{ ofKind('unknown').length }})</summary>
          <p class="xs t2">{{ m.notRecordedYet }}</p>
          <UnknownIssueList :items="unknownItems" />
        </details>

        <details v-if="coverage" class="coverage" :class="{ stale: !fresh }" data-test="coverage">
          <summary>
            {{ m.coverage }} · <b>{{ m.totalCredits(coverage.totalCredits, coverage.totalRequired) }}</b>
            <span v-if="short" class="chip bad" data-test="groups-short">{{ m.groupsShort(short) }}</span>
          </summary>
          <p>
            <span :class="coverage.graduation === 'done' ? 'ok' : 't2'">{{ m.graduation[coverage.graduation] }}</span>
          </p>
          <ul class="cov-list">
            <li v-for="group in coverage.groups" :key="group.id" :class="{ short: !group.met }">
              <span class="nm">{{ group.name }}</span>
              <span class="v">
                {{ m.groupCredits(group.credits, group.requiredCredits) }}
                <template v-if="group.met"> · {{ m.met }}</template>
                <template v-else-if="group.remainingCredits !== null"> · {{ m.short(group.remainingCredits) }}</template>
              </span>
            </li>
            <li v-for="min in coverage.combinedMinimums" :key="min.id" :class="{ short: !min.met }">
              <span class="nm">{{ min.name }}</span>
              <span class="v">
                {{ m.groupCredits(min.credits, min.creditsMin) }} · {{ min.met ? m.met : m.short(min.remainingCredits) }}
              </span>
            </li>
          </ul>
        </details>
      </template>
      <p v-else-if="status === 'loading'" class="t3">{{ m.checking }}</p>
    </div>
  </aside>
</template>

<style scoped>
.rail { display: flex; flex-direction: column; overflow: hidden; min-width: 0; padding: 0; }
.rail-head { display: flex; align-items: center; gap: 10px; padding: 14px 14px 10px; }
.rail-head h2 { flex: 1; font-size: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rail-toggle { width: 32px; height: 32px; border-radius: 9px; border: 0; background: var(--surface-2); color: var(--ink-2); display: grid; place-items: center; cursor: pointer; flex: none; }
.rail-toggle:hover { background: var(--surface-3); color: var(--ink); }
.rail-toggle .icon { width: 18px; height: 18px; transform: scaleX(-1); transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
.rail.mini .rail-toggle .icon { transform: none; }
.rail-n {
  min-width: 26px; height: 26px; padding: 0 8px; border-radius: 999px; background: var(--bad); color: #fff; font: 700 13px var(--display);
  display: grid; place-items: center; font-variant-numeric: tabular-nums; transition: background 0.25s; animation: bump 0.4s cubic-bezier(0.3, 1.6, 0.5, 1);
}
.rail-n.zero { background: var(--ok-bg, var(--ok)); }
@keyframes bump { 40% { transform: scale(1.28); } }
@keyframes pre-pulse { from { opacity: 0.35; } to { opacity: 0.75; } }
.rail-body { display: grid; gap: 10px; padding: 0 14px 14px; overflow-y: auto; min-height: 0; }
.rail-sub { font-size: 12.5px; color: var(--ink-3); display: flex; align-items: center; gap: 7px; margin: 0; }
.rail.previewing .rail-sub { color: var(--info); font-weight: 600; }
.rail-sub .live { width: 7px; height: 7px; border-radius: 50%; background: var(--info); flex: none; animation: pre-pulse 0.7s ease-in-out infinite alternate; }
.rail-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.vfoot .btn { margin-left: auto; }
.v-enter-active { transition: opacity 0.32s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1); }
.v-enter-from { opacity: 0; transform: translateX(14px); }
.v-move { transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
.tag { font-size: 11.5px; font-weight: 700; padding: 1px 8px; border-radius: 999px; background: var(--bad); color: #fff; }
.tag.ok { background: var(--ok); }
.rail-empty { display: grid; justify-items: center; gap: 4px; text-align: center; padding: 22px 10px; font-size: 13px; color: var(--ink-3); }
.rail-empty .icon { width: 28px; height: 28px; color: var(--ok); }
.rail-empty b { color: var(--ink); }
.rail.mini { cursor: pointer; }
.rail.mini .rail-head { flex-direction: column; padding: 12px 0; gap: 12px; }
.rail.mini .rail-head h2 { display: none; }
.unknowns summary, .coverage summary { cursor: pointer; font-weight: 650; font-size: 13.5px; color: var(--ink-2); }
.coverage summary .chip { margin-left: 6px; }
.unknowns[open], .coverage[open] { display: grid; gap: 8px; }
.coverage { font-size: 13.5px; }
.coverage .ok { color: color-mix(in oklab, var(--ok) 80%, var(--ink)); font-weight: 650; }
.cov-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.cov-list li { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; }
.cov-list .nm { min-width: 0; overflow-wrap: anywhere; color: var(--ink-2); }
.cov-list .v { white-space: nowrap; font-weight: 600; }
.cov-list li.short .v { color: color-mix(in oklab, var(--bad) 80%, var(--ink)); }
.rail .stale { opacity: 0.55; }
@media (max-width: 1180px) {
  .rail.mini .rail-head { flex-direction: row; padding: 14px 14px 12px; }
  .rail.mini .rail-head h2 { display: block; }
}
</style>
