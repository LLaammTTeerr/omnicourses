<script setup lang="ts">
import { computed } from 'vue';
import { useLocale, useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { termKey, termName } from '../terms.js';
import type { PlanIssue, PlanIssueKind } from './api.js';
import type { AttachedIssues } from './board.js';
import { PLANNER_MESSAGES, type IssueContext } from './messages.js';
import { ISSUE_KINDS_SHOWN, KIND_STYLE } from './present.js';

// The Issues panel (UC-05 step 2): the rule engine's report on the saved plan, as it came from GET /plans/{id}/issues.
// Violations, flags and unknowns look different, each issue has a short title, its wording and its citation, and
// nothing here is computed: the panel only sorts the report by kind and words each code. Issues about a term or a
// course are listed; requirement groups still short are counted under the coverage, which the status strip also
// shows. While a course is dragged, `preview` is the engine's report on the board with the drop made, and the panel
// says which violations it would add.
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
const where = (issue: PlanIssue) => (issue.term ? termName(issue.term, locale.lang) : m.value.wholePlan);
const coverage = computed(() => props.attached?.report.coverage ?? null);
/** Groups and combined minimums the engine finds short; the cohort total shows beside them on its own. */
const short = computed(() => [...(coverage.value?.groups ?? []), ...(coverage.value?.combinedMinimums ?? [])].filter((g) => !g.met).length);
const tileOf = (issue: PlanIssue) => props.attached?.tileOf.get(issue);

/** An issue's identity across two reports: its code, course and term (positions move when a tile does). */
const idOf = (i: PlanIssue) => [i.code, i.courseCode ?? '', i.term ? termKey(i.term) : '', i.requirementGroupId ?? ''].join('|');
const violationsOf = (a: AttachedIssues | null) => a?.report.issues.filter((i) => i.kind === 'violation' && i.term !== null) ?? [];
const previewNew = computed(() => {
  const next = props.preview?.attached;
  if (!next) return [];
  const now = new Set(violationsOf(props.attached).map(idOf));
  return violationsOf(next).filter((i) => !now.has(idOf(i)));
});
const previewDelta = computed(() => (props.preview?.attached ? violationsOf(props.preview.attached).length - violationsOf(props.attached).length : null));
</script>

<template>
  <aside class="card issues-panel" :class="{ mini: collapsed }" aria-labelledby="issues-title" :aria-busy="status === 'loading'" data-test="issues-panel">
    <div class="issues-head">
      <button
        class="btn sm ghost icon-only rail-toggle"
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
      <span v-if="status === 'loading'" class="chip" role="status" data-test="checking">{{ m.checking }}</span>
      <span v-else-if="collapsed && attached" class="chip" :class="ofKind('violation').length ? 'bad' : 'ok'" data-test="issues-mini-count">{{ ofKind('violation').length }}</span>
    </div>
    <div v-show="!collapsed" id="issues-body" class="issues-body">
      <p class="small t3">{{ m.issuesLead }}</p>

      <div v-if="status === 'failed'" class="callout bad small" role="alert" data-test="issues-failed">
        <Icon name="alert" size="sm" />
        <div>
          <p>{{ m.checkFailed }}</p>
          <button class="btn sm" type="button" @click="emit('retry')">{{ m.retry }}</button>
        </div>
      </div>

      <div v-if="preview" class="issue-preview" role="status" data-test="issues-preview">
        <p class="small">
          <b>{{ preview.label }}</b>
          <template v-if="previewDelta !== null"> · {{ m.previewDelta(previewDelta) }}</template>
          <template v-else> · {{ m.dropChecking }}</template>
        </p>
        <ul v-if="previewNew.length" class="issue-list">
          <li v-for="(issue, i) in previewNew" :key="i" class="issue violation new" data-test="preview-new">
            <span class="ic" aria-hidden="true"><Icon name="alert" size="sm" /></span>
            <div>
              <p><b>{{ m.issueTitle[issue.code] }}</b></p>
              <p class="small">{{ m.issue[issue.code](issue, ctx) }}</p>
            </div>
          </li>
        </ul>
      </div>

      <template v-if="attached">
        <div class="issue-counts" :class="{ stale: !fresh }" data-test="issue-counts">
          <span v-for="kind in ISSUE_KINDS_SHOWN" :key="kind" :class="['chip', KIND_STYLE[kind].tone]">
            <Icon :name="KIND_STYLE[kind].icon" size="sm" />{{ m.kindsPlural[kind](ofKind(kind).length) }}
          </span>
        </div>

        <p v-if="placed.length === 0" class="small" data-test="no-issues"><Icon name="check" size="sm" /> {{ m.noIssues }}</p>

        <section v-for="kind in (['violation', 'flag'] as const)" v-show="ofKind(kind).length" :key="kind" :class="{ stale: !fresh }">
          <h3 class="issues-kind">{{ m.kindHeadings[kind] }}</h3>
          <ul class="issue-list">
            <li v-for="(issue, i) in ofKind(kind)" :key="i" :class="['issue', kind]" :data-test="`issue-${kind}`">
              <span class="ic" aria-hidden="true"><Icon :name="KIND_STYLE[kind].icon" size="sm" /></span>
              <div>
                <p class="issue-title">
                  <span class="sr-only">{{ m.kinds[kind] }}: </span>
                  <button v-if="tileOf(issue) !== undefined" class="link-button" type="button" @click="emit('focusTile', tileOf(issue)!)">{{ m.issueTitle[issue.code] }}</button>
                  <b v-else>{{ m.issueTitle[issue.code] }}</b>
                </p>
                <p class="small" data-test="issue-text">{{ m.issue[issue.code](issue, ctx) }}</p>
                <p class="xs t3">
                  {{ where(issue) }} · <span class="cite" data-test="citation">{{ m.source }}: {{ issue.citation }}</span>
                </p>
              </div>
            </li>
          </ul>
        </section>

        <details v-if="ofKind('unknown').length" class="unknowns" :class="{ stale: !fresh }" data-test="unknowns">
          <summary>{{ m.kindHeadings.unknown }} ({{ ofKind('unknown').length }})</summary>
          <p class="xs t2">{{ m.notRecordedYet }}</p>
          <ul class="issue-list">
            <li v-for="(issue, i) in ofKind('unknown')" :key="i" class="issue unknown" data-test="issue-unknown">
              <span class="ic" aria-hidden="true"><Icon name="info" size="sm" /></span>
              <div>
                <p>{{ m.issue[issue.code](issue, ctx) }}</p>
                <p class="xs t3">{{ where(issue) }} · <span class="cite">{{ m.source }}: {{ issue.citation }}</span></p>
              </div>
            </li>
          </ul>
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

<style>
.issues-panel { display: grid; gap: 12px; align-content: start; }
.issues-panel.mini { padding: 10px; }
.issues-panel.mini h2 { writing-mode: vertical-rl; font-size: 14px; }
.issues-panel.mini .issues-head { flex-direction: column; justify-content: flex-start; }
.issues-body { display: grid; gap: 12px; }
.issues-head { display: flex; align-items: center; gap: 8px; }
.issues-head h2 { font-size: 18px; flex: 1 1 auto; }
.issue-counts { display: flex; flex-wrap: wrap; gap: 6px; }
.issues-panel .chip.line { background: transparent; border: 1px dashed var(--edge-strong); color: var(--ink-2); }
.issues-kind { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-3); margin-bottom: 6px; }
.issue-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.issue { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px; padding: 10px 12px; border-radius: 10px; font-size: 13.5px; border: 1px solid var(--edge); }
.issue .ic { margin-top: 1px; }
.issue .issue-title { font-weight: 700; }
.issue.violation { border-color: color-mix(in oklab, var(--bad) 45%, var(--edge)); background: color-mix(in oklab, var(--bad) 8%, var(--surface)); }
.issue.violation .ic { color: var(--bad); }
.issue.flag { border-color: color-mix(in oklab, var(--warn) 45%, var(--edge)); background: color-mix(in oklab, var(--warn) 8%, var(--surface)); }
.issue.flag .ic { color: var(--warn); }
.issue.unknown { border-style: dashed; background: transparent; color: var(--ink-2); }
.issue.new { border-style: dashed; }
.issue .cite { font-family: var(--mono); }
.issue-preview { display: grid; gap: 8px; padding: 10px 12px; border-radius: 10px; background: color-mix(in oklab, var(--info) 10%, var(--surface)); }
.link-button { all: unset; cursor: pointer; text-decoration: underline; text-decoration-color: var(--edge-strong); }
.link-button:focus-visible { outline: 2px solid var(--info); outline-offset: 2px; }
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
.issues-panel .stale { opacity: 0.55; }
</style>
