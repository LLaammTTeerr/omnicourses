<script setup lang="ts">
import { computed } from 'vue';
import { useLocale, useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { REGULATION_URL } from '../shell/messages.js';
import { termKey, termName } from '../terms.js';
import type { PlanIssue, PlanIssueKind } from './api.js';
import type { AttachedIssues } from './board.js';
import { PLANNER_MESSAGES, type IssueContext } from './messages.js';
import { ISSUE_KINDS_SHOWN, KIND_STYLE } from './present.js';

// The Issues panel (UC-05 step 2), drawn as the prototype's rail (planner.html): the rule engine's report on the saved
// plan, as it came from GET /plans/{id}/issues. Each violation or flag is a card with its short title, its wording,
// the term, the regulation it cites and a button to the course. Nothing here is computed: the panel only sorts the
// report by kind and words each code. While a course is dragged, `preview` is the engine's report on the board with
// the drop made, and the rail shows that report instead, marking what the drop would add ("New") and remove.
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
/** Groups and combined minimums the engine finds short; the cohort total shows beside them on its own. */
const short = computed(() => [...(coverage.value?.groups ?? []), ...(coverage.value?.combinedMinimums ?? [])].filter((g) => !g.met).length);
const tileOf = (issue: PlanIssue) => props.attached?.tileOf.get(issue);

/** An issue's identity across two reports: its code, course and term (positions move when a tile does). */
const idOf = (i: PlanIssue) => [i.code, i.courseCode ?? '', i.term ? termKey(i.term) : '', i.requirementGroupId ?? ''].join('|');
const listed = (a: AttachedIssues | null | undefined) => a?.report.issues.filter((i) => (i.kind === 'violation' || i.kind === 'flag') && i.term !== null) ?? [];
const violationsOf = (a: AttachedIssues | null | undefined) => listed(a).filter((i) => i.kind === 'violation');

/** The cards: the current report, or while previewing the report with the drop made, plus what it would remove. */
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
/** The red count: violations of the report on show, so it moves while a course is dragged. */
const count = computed(() => violationsOf(props.preview?.attached ?? props.attached).length);

/** "QĐ 1175/QĐ-KHTN Điều 7.2.a" is a clause of the training regulation: a link to it, labelled by the clause. */
const clause = (citation: string) => /Điều\s+[\w.]+/.exec(citation)?.[0] ?? null;
/** A click anywhere on the folded rail opens it, as in the prototype. */
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
        <div class="issue-counts" :class="{ stale: !fresh }" data-test="issue-counts">
          <span v-for="kind in ISSUE_KINDS_SHOWN" :key="kind" :class="['chip', KIND_STYLE[kind].tone]">
            <Icon :name="KIND_STYLE[kind].icon" size="sm" />{{ m.kindsPlural[kind](ofKind(kind).length) }}
          </span>
        </div>

        <TransitionGroup v-if="cards.length" tag="ul" name="v" class="rail-list" :class="{ stale: !fresh && !preview }">
          <li
            v-for="c in cards"
            :key="c.id"
            :class="['vitem', c.issue.kind, c.state]"
            :data-test="c.state === 'gone' ? 'issue-gone' : `issue-${c.issue.kind}`"
          >
            <span class="ic" aria-hidden="true"><Icon :name="icon(c)" size="sm" /></span>
            <div>
              <b><span class="sr-only">{{ m.kinds[c.issue.kind] }}: </span>{{ m.issueTitle[c.issue.code] }}</b>
              <p data-test="issue-text">{{ m.issue[c.issue.code](c.issue, ctx) }}</p>
              <div class="vfoot">
                <span v-if="c.issue.term" class="chip line">{{ termName(c.issue.term, locale.lang) }}</span>
                <a
                  v-if="clause(c.issue.citation)"
                  class="ref"
                  :href="REGULATION_URL"
                  target="_blank"
                  rel="noopener noreferrer"
                  :title="m.sourceTitle(c.issue.citation)"
                  data-test="citation"
                ><Icon name="book" size="sm" /><span class="sr-only">{{ m.source }}: {{ c.issue.citation }}</span><span aria-hidden="true">{{ clause(c.issue.citation) }}</span></a>
                <span v-else class="chip line" data-test="citation">{{ c.issue.citation }}</span>
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
              </div>
            </div>
          </li>
        </TransitionGroup>
        <!-- No card: say what is still open below (groups short, rules not checked), never "no problem" over them. -->
        <div v-else class="rail-empty" :class="{ open: short > 0 }" data-test="no-issues">
          <Icon :name="short ? 'info' : 'check'" />
          <b>{{ short ? m.noTermViolations : m.noIssuesTitle }}</b>
          <span>{{ short ? m.groupsStillShort(short) : ofKind('unknown').length ? m.unknownsLeft(ofKind('unknown').length) : m.noIssues }}</span>
        </div>

        <details v-if="ofKind('unknown').length" class="unknowns" :class="{ stale: !fresh }" data-test="unknowns">
          <summary>{{ m.kindHeadings.unknown }} ({{ ofKind('unknown').length }})</summary>
          <p class="xs t2">{{ m.notRecordedYet }}</p>
          <ul class="unknown-list">
            <li v-for="(issue, i) in ofKind('unknown')" :key="i" data-test="issue-unknown">
              <Icon name="info" size="sm" />
              <span>{{ m.issue[issue.code](issue, ctx) }} <span class="t3">· {{ issue.term ? termName(issue.term, locale.lang) : m.wholePlan }}</span></span>
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
.rail-n.zero { background: var(--ok); }
@keyframes bump { 40% { transform: scale(1.28); } }
.rail-body { display: grid; gap: 10px; padding: 0 14px 14px; overflow-y: auto; min-height: 0; }
.rail-sub { font-size: 12.5px; color: var(--ink-3); display: flex; align-items: center; gap: 7px; margin: 0; }
.rail.previewing .rail-sub { color: var(--info); font-weight: 600; }
.rail-sub .live { width: 7px; height: 7px; border-radius: 50%; background: var(--info); flex: none; animation: pre-pulse 0.7s ease-in-out infinite alternate; }
.issue-counts { display: flex; flex-wrap: wrap; gap: 6px; }
.rail .chip.line { background: transparent; border: 1px dashed var(--edge-strong); color: var(--ink-2); min-height: 20px; font-size: 12px; }
.rail-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.vitem {
  display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 10px; padding: 10px 12px; border-radius: 12px;
  background: color-mix(in oklab, var(--bad) 5%, var(--surface)); border: 1px solid color-mix(in oklab, var(--bad) 22%, var(--edge));
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s, opacity 0.2s;
}
.vitem .ic { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; background: var(--bad); color: #fff; }
.vitem b { display: block; font-size: 13.5px; line-height: 1.35; }
.vitem p { font-size: 12.5px; color: var(--ink-2); margin: 2px 0 0; }
.vfoot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
.vfoot .btn { margin-left: auto; }
.vitem.flag { background: color-mix(in oklab, var(--warn) 6%, var(--surface)); border-color: color-mix(in oklab, var(--warn) 26%, var(--edge)); }
.vitem.flag .ic { background: var(--warn); }
.vitem.new { box-shadow: 0 0 0 2px color-mix(in oklab, var(--bad) 40%, transparent); }
.vitem.gone { background: color-mix(in oklab, var(--ok) 6%, var(--surface)); border-color: color-mix(in oklab, var(--ok) 30%, var(--edge)); }
.vitem.gone .ic { background: var(--ok); }
.vitem.gone b { color: var(--ink-2); text-decoration: line-through; text-decoration-color: color-mix(in oklab, var(--ink-3) 60%, transparent); }
.v-enter-active { transition: opacity 0.32s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1); }
.v-enter-from { opacity: 0; transform: translateX(14px); }
.v-move { transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
.ref {
  display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 650; text-decoration: none; padding: 1px 8px; border-radius: 999px;
  border: 1px solid var(--edge-strong); color: var(--ink-2); background: var(--surface); white-space: nowrap;
}
.ref .icon { width: 13px; height: 13px; }
.ref:hover { border-color: var(--ink-3); color: var(--ink); }
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
.unknown-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 12.5px; color: var(--ink-2); }
.unknown-list li { display: flex; gap: 6px; align-items: flex-start; }
.unknown-list .icon { flex: none; width: 14px; height: 14px; margin-top: 2px; color: var(--ink-3); }
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
