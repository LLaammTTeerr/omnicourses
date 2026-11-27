<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { statusOf } from '../api.js';
import { useAsyncLoad } from '../async-load.js';
import { courseName, groupColour, orderGroups } from '../curriculum/present.js';
import { GROUPS, groupClass, type GroupId } from '../groups.js';
import { formatDateTime, useLocale, useMessages } from '../locale.js';
import { usePageTitle } from '../page-title.js';
import type { PlanIssue, PlanIssueKind } from '../plans/api.js';
import { PLANNER_MESSAGES } from '../plans/messages.js';
import { BAR_CODES, capOf, clause, ISSUE_KINDS_SHOWN, KIND_STYLE, meter, toneOf } from '../plans/issue-view.js';
import Icon from '../shell/Icon.vue';
import { REGULATION_URL } from '../shell/messages.js';
import { termKey, termName } from '../terms.js';
import { fetchSharedPlan, type SharedPlacement, type SharedPlanIssue, type SharedPlanTerm } from './api.js';
import { SHARING_MESSAGES } from './messages.js';

const props = defineProps<{ token: string }>();

const locale = useLocale();
const m = useMessages(SHARING_MESSAGES);
const planner = useMessages(PLANNER_MESSAGES);

let ownedRobotsMeta: HTMLMetaElement | null = null;
let previousRobotsMeta: { el: HTMLMetaElement; content: string } | null = null;

onMounted(() => {
  const existing = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (existing) {
    previousRobotsMeta = { el: existing, content: existing.content };
    existing.content = 'noindex, nofollow';
  } else {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    ownedRobotsMeta = meta;
  }
});

onBeforeUnmount(() => {
  if (ownedRobotsMeta) {
    ownedRobotsMeta.remove();
    ownedRobotsMeta = null;
  } else if (previousRobotsMeta) {
    previousRobotsMeta.el.content = previousRobotsMeta.content;
    previousRobotsMeta = null;
  }
});

const { status, data: shared, error, reload } = useAsyncLoad(
  'the shared plan',
  () => fetchSharedPlan(props.token),
  () => props.token,
);

const notShared = computed(() => status.value === 'loaded' && shared.value === null);

usePageTitle(() => shared.value?.name ?? (notShared.value ? m.value.notSharedTitle : m.value.sharedPlanTitle));

const glyphOf = (colour: GroupId) => GROUPS.find((g) => g.id === colour)!.glyph;

function toEngineIssue(issue: SharedPlanIssue): PlanIssue {
  return {
    code: issue.code,
    kind: issue.kind,
    term: issue.term,
    position: issue.position,
    courseCode: issue.courseCode,
    requirementGroupId: issue.requirementGroupName ?? issue.combinedMinimumName ?? null,
    combinedMinimumId: null,
    missingCourseCodes: issue.missingCourseCodes ?? [],
    offeredTermNumbers: issue.offeredTermNumbers,
    credits: issue.credits,
    limit: issue.limit,
    citation: issue.citation,
    message: issue.message,
  };
}

function wordIssue(issue: SharedPlanIssue): string {
  const adapted = toEngineIssue(issue);
  return planner.value.issue[issue.code](adapted, { requirementName: (i) => i.requirementGroupId });
}

const curriculumMeta = computed(() => {
  const cur = shared.value?.curriculum;
  if (!cur) return '';
  const programLabel = `${courseName(cur.program, locale.lang)} (${cur.program.code})`;
  const curName = courseName(cur, locale.lang).trim();
  const parts = [programLabel, m.value.cohort(cur.cohortYear), m.value.curriculumCode(cur.code)];
  const lower = curName.toLowerCase();
  const repeatsProgram = [cur.program.nameVi, cur.program.nameEn, cur.code]
    .filter((s): s is string => Boolean(s?.trim()))
    .some((s) => lower.includes(s.trim().toLowerCase()));
  if (curName && !repeatsProgram) {
    parts.push(curName);
  }
  return parts.join(' · ');
});

const withheldTitles = computed(() => (shared.value?.issueCodesNotShown ?? []).map((code) => planner.value.issueTitle[code]));

interface SharedTileView {
  placement: SharedPlacement;
  title: string;
  name: string | null;
  credits: number | null;
  slot: boolean;
  colour: GroupId | null;
  tone: string;
  bad: boolean;
  issues: SharedPlanIssue[];
  unknowns: SharedPlanIssue[];
}

interface SharedRowView {
  key: string;
  name: string;
  when: string;
  summer: boolean;
  credits: number;
  atLeast: boolean;
  maxCap: number | null;
  capsLabel: string;
  meter: ReturnType<typeof meter>;
  cap: ReturnType<typeof capOf>;
  tone: string;
  rowIssues: SharedPlanIssue[];
  tiles: SharedTileView[];
}

function buildTileView(placement: SharedPlacement, posIssues: SharedPlanIssue[]): SharedTileView {
  const adapted = posIssues.map(toEngineIssue);
  const tone = toneOf(adapted);
  const slot = placement.kind === 'slot';
  const colour = slot && placement.requirementGroupName ? groupColour({ name: placement.requirementGroupName, kind: 'elective' }) : null;
  const title = slot
    ? planner.value.slot(placement.requirementGroupName ?? planner.value.slotGroupUnknown)
    : (placement.courseCode ?? '?');
  const name = !slot && placement.nameVi !== null ? courseName({ nameVi: placement.nameVi, nameEn: placement.nameEn }, locale.lang) : null;
  return {
    placement,
    title,
    name,
    credits: placement.credits,
    slot,
    colour,
    tone,
    bad: tone === 'has-violation',
    issues: [
      ...posIssues.filter((i) => i.kind === 'violation'),
      ...posIssues.filter((i) => i.kind === 'flag'),
    ],
    unknowns: posIssues.filter((i) => i.kind === 'unknown'),
  };
}

function buildRowView(termEntry: SharedPlanTerm, allIssues: readonly SharedPlanIssue[]): SharedRowView {
  const key = termKey(termEntry.term);
  const inTerm = allIssues.filter((i) => i.term !== null && termKey(i.term) === key);
  const wholeTerm = inTerm.filter((i) => i.position === null);
  const adaptedInTerm = inTerm.map(toEngineIssue);
  const load = {
    term: termEntry.term,
    kind: termEntry.kind,
    credits: termEntry.credits,
    caps: termEntry.caps,
  };
  return {
    key,
    name: termName(termEntry.term, locale.lang),
    when: planner.value.termMonths(termEntry.term),
    summer: termEntry.kind === 'summer',
    credits: termEntry.credits,
    atLeast: wholeTerm.some((i) => i.code === 'load_not_checked'),
    maxCap: termEntry.caps?.max ?? null,
    capsLabel: termEntry.caps ? planner.value.caps(termEntry.caps.min, termEntry.caps.max) : planner.value.capsUnknown,
    meter: meter(load, termEntry.credits),
    cap: capOf(adaptedInTerm, termEntry.credits),
    tone: toneOf(adaptedInTerm),
    rowIssues: wholeTerm,
    tiles: termEntry.placements.map((placement, index) =>
      buildTileView(
        placement,
        inTerm.filter((i) => i.position === index),
      ),
    ),
  };
}

const termRows = computed(() => {
  const plan = shared.value;
  if (!plan) return [];
  return plan.terms.map((t) => buildRowView(t, plan.issues));
});

const placedIssues = computed(() => (shared.value?.issues ?? []).filter((i) => i.term !== null));
const issuesOfKind = (kind: PlanIssueKind) => placedIssues.value.filter((i) => i.kind === kind);
const listedIssues = computed(() => [
  ...issuesOfKind('violation'),
  ...issuesOfKind('flag'),
]);
const unknownIssues = computed(() => issuesOfKind('unknown'));
const violationCount = computed(() => issuesOfKind('violation').length);

const orderedCoverageGroups = computed(() => (shared.value?.coverage ? orderGroups(shared.value.coverage.groups) : []));
const shortGroupsCount = computed(() => {
  const cov = shared.value?.coverage;
  if (!cov) return 0;
  return [...cov.groups, ...cov.combinedMinimums].filter((g) => !g.met).length;
});

function printPlan(): void {
  window.print();
}
</script>

<template>
  <div class="page shared-plan-page" :aria-busy="status === 'loading'">
    <p v-if="status === 'loading'" class="t3" role="status" data-test="shared-loading">{{ m.viewLoading }}</p>

    <div v-else-if="status === 'failed'" class="callout bad" role="alert" data-test="shared-failed">
      <Icon name="alert" />
      <div class="failed-body">
        <p>{{ statusOf(error) === 429 ? m.rateLimited : m.viewLoadFailed }}</p>
        <button class="btn sm" type="button" data-test="retry" @click="reload">{{ m.retry }}</button>
      </div>
    </div>

    <div v-else-if="notShared" class="card not-shared-card" data-test="not-shared">
      <span class="glyph lg g-thesis" aria-hidden="true">∅</span>
      <h1>{{ m.notSharedTitle }}</h1>
      <p class="t2">{{ m.notSharedBody }}</p>
      <RouterLink class="btn" :to="{ name: 'home' }">{{ m.backHome }}</RouterLink>
    </div>

    <template v-else-if="shared">
      <div class="readonly-banner" role="note" data-test="readonly-banner">
        <Icon name="lock" size="sm" />
        <b>{{ m.readonlyBanner }}</b>
        <span class="small">{{ m.updatedAt(formatDateTime(shared.updatedAt, locale.lang)) }}</span>
      </div>

      <header class="page-head">
        <div>
          <p v-if="shared.ownerName" class="eyebrow" data-test="owner-name">{{ m.sharedBy(shared.ownerName) }}</p>
          <h1>{{ shared.name }}</h1>
          <p data-test="curriculum-meta">{{ curriculumMeta }}</p>
        </div>
        <div class="head-actions no-print">
          <button class="btn primary" type="button" data-test="print-pdf" @click="printPlan">
            <Icon name="download" size="sm" />{{ m.printPdf }}
          </button>
        </div>
      </header>

      <div v-if="withheldTitles.length > 0" class="callout warn" role="note" data-test="withheld-checks-notice">
        <Icon name="info" />
        <div>
          <b>{{ m.withheldTitle }}</b>
          <p>{{ m.withheldBody(withheldTitles) }}</p>
        </div>
      </div>

      <section v-if="shared.coverage" class="card coverage-card" aria-labelledby="shared-coverage-title" data-test="shared-coverage">
        <div class="cov-head">
          <div>
            <h2 id="shared-coverage-title">{{ planner.coverage }}</h2>
            <p class="small" :class="shared.coverage.graduation === 'done' ? 'grad-ok' : 't2'" data-test="graduation-verdict">
              {{ planner.graduation[shared.coverage.graduation] }}
            </p>
          </div>
          <div class="cov-badges">
            <span class="chip ink">{{ planner.totalCredits(shared.coverage.totalCredits, shared.coverage.totalRequired) }}</span>
            <span v-if="shortGroupsCount > 0" class="chip bad" data-test="groups-short">{{ planner.groupsShort(shortGroupsCount) }}</span>
          </div>
        </div>

        <ul v-if="orderedCoverageGroups.length" class="cov-grid">
          <li
            v-for="group in orderedCoverageGroups"
            :key="group.name"
            :class="['cov-item', groupClass(groupColour(group)), { short: !group.met }]"
            data-test="coverage-group"
          >
            <span class="glyph sm" aria-hidden="true">{{ glyphOf(groupColour(group)) }}</span>
            <div class="cov-body">
              <span class="nm">{{ group.name }}</span>
              <span class="v">
                {{ planner.groupCredits(group.credits, group.requiredCredits) }}
                <template v-if="group.met"> · {{ planner.met }}</template>
                <template v-else-if="group.remainingCredits !== null"> · {{ planner.short(group.remainingCredits) }}</template>
              </span>
            </div>
          </li>
        </ul>

        <div v-if="shared.coverage.combinedMinimums.length" class="combined-section">
          <h3 class="small t2">{{ m.combinedMinimumsHeading }}</h3>
          <ul class="cov-list">
            <li
              v-for="min in shared.coverage.combinedMinimums"
              :key="min.name"
              :class="['cov-min', { short: !min.met }]"
              data-test="coverage-combined"
            >
              <span class="nm">{{ min.name }}</span>
              <span class="v">
                {{ planner.groupCredits(min.credits, min.creditsMin) }} · {{ min.met ? planner.met : planner.short(min.remainingCredits) }}
              </span>
            </li>
          </ul>
        </div>
      </section>

      <div class="shared-layout">
        <div class="shared-main" data-test="shared-terms">
          <div v-if="termRows.length === 0" class="card empty-terms t2" data-test="empty-terms">
            {{ m.emptyTerms }}
          </div>
          <div v-else class="rows" role="list" :aria-label="planner.termsLabel">
            <section
              v-for="row in termRows"
              :key="row.key"
              role="listitem"
              :class="['trow', row.tone]"
              :aria-labelledby="`shared-term-${row.key}`"
              :data-test="`term-${row.key}`"
            >
              <div class="trow-l">
                <div class="tname">
                  <h3 :id="`shared-term-${row.key}`">{{ row.name }}</h3>
                  <span v-if="row.summer" class="chip info">{{ planner.summer }}</span>
                  <small class="when">{{ row.when }}</small>
                </div>
                <div class="tload" :title="row.capsLabel" data-test="term-load">
                  <template v-if="row.atLeast">{{ `${planner.atLeast} ` }}</template>
                  <b>{{ row.credits }}</b>{{ planner.ofCap(row.maxCap) }}
                  <span class="caps-text"> · {{ row.capsLabel }}</span>
                </div>
                <div v-if="row.meter" :class="['cap', row.cap]" aria-hidden="true">
                  <span class="track">
                    <i class="fill" :style="{ width: `${row.meter.fill}%` }" />
                  </span>
                  <span v-if="row.meter.min !== null" class="tick" :style="{ left: `${row.meter.min}%` }"><em>{{ row.meter.minLabel }}</em></span>
                  <span class="tick max" :style="{ left: `${row.meter.max}%` }"><em>{{ row.meter.maxLabel }}</em></span>
                </div>
                <ul v-if="row.rowIssues.length" class="row-issues">
                  <li
                    v-for="(issue, idx) in row.rowIssues"
                    :key="idx"
                    :class="['ri', issue.kind, { 'sr-only': BAR_CODES.has(issue.code) }]"
                    :data-test="`row-issue-${issue.kind}`"
                  >
                    <Icon :name="KIND_STYLE[issue.kind].icon" size="sm" />
                    <span>{{ planner.issueTitle[issue.code] }}</span>
                  </li>
                </ul>
              </div>

              <p v-if="row.tiles.length === 0" class="small t3 empty-row">{{ m.emptyTerm }}</p>
              <ul v-else class="tiles">
                <li
                  v-for="(tile, idx) in row.tiles"
                  :key="idx"
                  :class="['ptile', tile.colour ? groupClass(tile.colour) : 'g-core', { slot: tile.slot }, tile.tone]"
                  :data-test="`placement-${tile.placement.courseCode ?? 'slot'}`"
                >
                  <span v-if="tile.bad" class="flag-badge" aria-hidden="true">!</span>
                  <span class="top">
                    <span class="k">{{ tile.title }}</span>
                    <span v-if="tile.credits !== null" class="cr">{{ planner.credits(tile.credits) }}</span>
                  </span>
                  <span v-if="tile.name" class="nm">{{ tile.name }}</span>
                  <span v-else-if="tile.slot" class="nm t3">{{ planner.slotNotChosen }}</span>
                  <ul v-if="tile.issues.length || tile.unknowns.length" class="tile-issues">
                    <li
                      v-for="(issue, i) in tile.issues"
                      :key="`i-${i}`"
                      :class="['ti', issue.kind]"
                      :data-test="`tile-issue-${issue.kind}`"
                    >
                      {{ planner.issueTitle[issue.code] }}
                    </li>
                    <li v-if="tile.unknowns.length" class="ti unknown" data-test="tile-issue-unknown">
                      {{ planner.unknownWhat(tile.unknowns.map((u) => u.code)) }}
                    </li>
                  </ul>
                </li>
              </ul>
            </section>
          </div>
        </div>

        <aside class="card issues-rail" aria-labelledby="shared-issues-title" data-test="shared-issues">
          <div class="rail-head">
            <h2 id="shared-issues-title">{{ planner.issuesTitle }}</h2>
            <span class="rail-n" :class="{ zero: violationCount === 0 }" data-test="violation-count">{{ violationCount }}</span>
          </div>
          <p class="rail-sub">{{ m.issuesLead }}</p>

          <div class="issue-counts" data-test="issue-counts">
            <span v-for="kind in ISSUE_KINDS_SHOWN" :key="kind" :class="['chip', KIND_STYLE[kind].tone]">
              <Icon :name="KIND_STYLE[kind].icon" size="sm" />{{ planner.kindsPlural[kind](issuesOfKind(kind).length) }}
            </span>
          </div>

          <ul v-if="listedIssues.length" class="rail-list">
            <li
              v-for="(issue, idx) in listedIssues"
              :key="idx"
              :class="['vitem', issue.kind]"
              :data-test="`issue-${issue.kind}`"
            >
              <span class="ic" aria-hidden="true"><Icon :name="KIND_STYLE[issue.kind].icon" size="sm" /></span>
              <div>
                <b><span class="sr-only">{{ planner.kinds[issue.kind] }}: </span>{{ planner.issueTitle[issue.code] }}</b>
                <p data-test="issue-text">{{ wordIssue(issue) }}</p>
                <div class="vfoot">
                  <span class="chip line">{{ issue.term ? termName(issue.term, locale.lang) : planner.wholePlan }}</span>
                  <a
                    v-if="clause(issue.citation)"
                    class="ref"
                    :href="REGULATION_URL"
                    target="_blank"
                    rel="noopener noreferrer"
                    :title="planner.sourceTitle(issue.citation)"
                    data-test="citation"
                  >
                    <Icon name="book" size="sm" />
                    <span class="sr-only">{{ planner.source }}: {{ issue.citation }}</span>
                    <span aria-hidden="true">{{ clause(issue.citation) }}</span>
                  </a>
                  <span v-else class="chip line" data-test="citation">{{ issue.citation }}</span>
                </div>
              </div>
            </li>
          </ul>

          <div v-else class="rail-empty" :class="{ partial: withheldTitles.length > 0 || shortGroupsCount > 0 }" data-test="no-issues">
            <Icon :name="withheldTitles.length > 0 || shortGroupsCount > 0 ? 'info' : 'check'" />
            <template v-if="withheldTitles.length > 0">
              <b>{{ m.noIssuesPartialTitle }}</b>
              <span>{{ m.noIssuesPartialBody }}</span>
            </template>
            <template v-else-if="shortGroupsCount > 0">
              <b>{{ planner.noTermViolations }}</b>
              <span>{{ planner.groupsStillShort(shortGroupsCount) }}</span>
            </template>
            <template v-else>
              <b>{{ planner.noIssuesTitle }}</b>
              <span>{{ unknownIssues.length ? planner.unknownsLeft(unknownIssues.length) : planner.noIssues }}</span>
            </template>
          </div>

          <div v-if="unknownIssues.length" class="unknowns-block" data-test="shared-unknowns">
            <h3 class="small">{{ planner.kindHeadings.unknown }} ({{ unknownIssues.length }})</h3>
            <p class="xs t2">{{ planner.notRecordedYet }}</p>
            <ul class="unknown-list">
              <li v-for="(issue, idx) in unknownIssues" :key="idx" data-test="issue-unknown">
                <Icon name="info" size="sm" />
                <span>
                  {{ wordIssue(issue) }}
                  <span class="t3"> · {{ issue.term ? termName(issue.term, locale.lang) : planner.wholePlan }}</span>
                </span>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <p class="small t3 privacy-note" data-test="privacy-footer">{{ m.privacyFooter }}</p>
    </template>
  </div>
</template>

<style scoped>
.shared-plan-page {
  max-width: 1400px;
}
.failed-body {
  display: grid;
  gap: 8px;
  justify-items: start;
}
.not-shared-card {
  max-width: 600px;
  margin: 32px auto;
  padding: 48px 28px;
  display: grid;
  gap: 12px;
  justify-items: center;
  text-align: center;
}
.readonly-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 16px;
  border-radius: 12px;
  background: color-mix(in oklab, var(--info) 12%, var(--surface));
  border: 1px solid color-mix(in oklab, var(--info) 34%, var(--edge));
  color: var(--ink);
}
.readonly-banner span {
  margin-left: auto;
  color: var(--ink-2);
}
.eyebrow {
  font-size: 13px;
  font-weight: 650;
  color: var(--info);
  margin-bottom: 4px;
}
.shared-plan-page .page-head {
  align-items: flex-start;
}
.shared-plan-page .page-head h1 {
  overflow-wrap: anywhere;
}

.coverage-card {
  display: grid;
  gap: 14px;
}
.cov-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}
.cov-head p {
  margin-top: 3px;
}
.grad-ok {
  color: color-mix(in oklab, var(--ok) 80%, var(--ink));
  font-weight: 650;
}
.cov-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.cov-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 10px;
}
.cov-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--surface-2);
  border: 1px solid var(--edge);
}
.cov-item.short {
  border-color: color-mix(in oklab, var(--bad) 38%, var(--edge));
}
.cov-body {
  min-width: 0;
  display: grid;
  gap: 2px;
}
.cov-body .nm {
  font-size: 13px;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.cov-body .v {
  font-size: 12.5px;
  color: var(--ink-2);
}
.cov-item.short .v {
  color: color-mix(in oklab, var(--bad) 80%, var(--ink));
  font-weight: 600;
}
.combined-section {
  display: grid;
  gap: 6px;
  border-top: 1px solid var(--line);
  padding-top: 10px;
}
.cov-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
}
.cov-min {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}
.cov-min.short .v {
  color: color-mix(in oklab, var(--bad) 80%, var(--ink));
  font-weight: 600;
}

.shared-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 350px;
  gap: 18px;
  align-items: start;
}
.rows {
  display: grid;
  gap: 12px;
}
.trow {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 16px;
  padding: 14px 16px;
  border-radius: var(--r);
  background: var(--surface);
  border: 1px solid var(--edge);
  box-shadow: var(--shadow);
}
.trow.has-violation {
  border-color: color-mix(in oklab, var(--bad) 45%, var(--edge));
}
.trow.has-flag {
  border-color: color-mix(in oklab, var(--warn) 45%, var(--edge));
}
.trow-l {
  display: grid;
  align-content: start;
  gap: 6px;
  padding-right: 12px;
  border-right: 1px solid var(--line);
}
.tname {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.tname .when {
  width: 100%;
  font-size: 12px;
  color: var(--ink-3);
}
.tload {
  font-size: 13px;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}
.tload b {
  font-size: 16px;
  color: var(--ink);
}
.caps-text {
  font-size: 12px;
  color: var(--ink-3);
}
.cap {
  position: relative;
  padding-bottom: 14px;
}
.cap .track {
  display: block;
  height: 6px;
  border-radius: 999px;
  background: var(--surface-3);
  overflow: hidden;
}
.cap .fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--info);
}
.cap.ok .fill {
  background: var(--ok);
}
.cap.under .fill {
  background: var(--warn);
}
.cap.over .fill {
  background: var(--bad);
}
.cap .tick {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
}
.cap .tick::before {
  content: '';
  display: block;
  width: 2px;
  height: 8px;
  background: var(--ink-3);
  margin: -1px auto 0;
}
.cap .tick em {
  display: block;
  font: 600 10.5px var(--mono);
  color: var(--ink-3);
  margin-top: 1px;
}
.row-issues {
  list-style: none;
  margin: 2px 0 0;
  padding: 0;
  display: grid;
  gap: 4px;
}
.ri {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-2);
}
.ri.violation {
  color: color-mix(in oklab, var(--bad) 82%, var(--ink));
}
.ri.flag {
  color: color-mix(in oklab, var(--warn) 80%, var(--ink));
}
.empty-row {
  align-self: center;
}
.tiles {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
  gap: 10px;
  align-content: start;
}
.ptile {
  position: relative;
  display: grid;
  gap: 4px;
  align-content: start;
  min-width: 0;
  padding: 9px 11px 9px 15px;
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--edge-strong);
}
.ptile::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 4px;
  background: var(--c, var(--core));
}
.ptile.slot {
  background: var(--surface-2);
  color: var(--ink-2);
  border-style: dashed;
}
.ptile.slot::before {
  display: none;
}
.ptile.has-violation {
  border-color: var(--bad);
  background: color-mix(in oklab, var(--bad) 5%, var(--surface));
}
.ptile.has-flag {
  border-color: var(--warn);
}
.flag-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--bad);
  color: #fff;
  font: 700 11px var(--display);
}
.ptile .top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ptile .k {
  font: 700 12px var(--mono);
  overflow-wrap: anywhere;
}
.ptile .cr {
  font: 650 11.5px var(--display);
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--c, var(--surface-3));
  color: var(--on, var(--ink));
  white-space: nowrap;
}
.ptile.slot .cr {
  background: var(--surface-3);
  color: var(--ink);
}
.ptile .nm {
  font-weight: 650;
  font-size: 13.5px;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.tile-issues {
  list-style: none;
  margin: 2px 0 0;
  padding: 0;
  display: grid;
  gap: 2px;
  font-size: 11.5px;
  font-weight: 600;
}
.ti.violation {
  color: color-mix(in oklab, var(--bad) 82%, var(--ink));
}
.ti.flag {
  color: color-mix(in oklab, var(--warn) 80%, var(--ink));
}
.ti.unknown {
  color: var(--ink-3);
  font-weight: 500;
}

.issues-rail {
  display: grid;
  gap: 12px;
  padding: 16px;
}
.rail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.rail-n {
  min-width: 26px;
  height: 26px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--bad);
  color: #fff;
  font: 700 13px var(--display);
  display: grid;
  place-items: center;
}
.rail-n.zero {
  background: var(--ok-bg, var(--ok));
}
.rail-sub {
  font-size: 12.5px;
  color: var(--ink-3);
}
.issue-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip.line {
  background: transparent;
  border: 1px dashed var(--edge-strong);
  color: var(--ink-2);
  min-height: 20px;
  font-size: 12px;
}
.rail-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.vitem {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in oklab, var(--bad) 5%, var(--surface));
  border: 1px solid color-mix(in oklab, var(--bad) 24%, var(--edge));
}
.vitem .ic {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: var(--bad);
  color: #fff;
}
.vitem.flag {
  background: color-mix(in oklab, var(--warn) 6%, var(--surface));
  border-color: color-mix(in oklab, var(--warn) 28%, var(--edge));
}
.vitem.flag .ic {
  background: var(--warn);
}
.vitem b {
  display: block;
  font-size: 13.5px;
  line-height: 1.35;
}
.vitem p {
  font-size: 12.5px;
  color: var(--ink-2);
  margin-top: 2px;
  overflow-wrap: anywhere;
}
.vfoot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.ref {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 650;
  text-decoration: none;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--edge-strong);
  color: var(--ink-2);
  background: var(--surface);
}
.ref .icon {
  width: 13px;
  height: 13px;
}
.rail-empty {
  display: grid;
  justify-items: center;
  gap: 4px;
  text-align: center;
  padding: 20px 10px;
  font-size: 13px;
  color: var(--ink-3);
}
.rail-empty .icon {
  width: 28px;
  height: 28px;
  color: var(--ok);
}
.rail-empty.partial .icon {
  color: var(--info);
}
.rail-empty b {
  color: var(--ink);
}
.unknowns-block {
  display: grid;
  gap: 6px;
  border-top: 1px solid var(--line);
  padding-top: 10px;
}
.unknown-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
  font-size: 12.5px;
  color: var(--ink-2);
}
.unknown-list li {
  display: flex;
  gap: 6px;
  align-items: flex-start;
}
.unknown-list .icon {
  flex: none;
  width: 14px;
  height: 14px;
  margin-top: 2px;
  color: var(--ink-3);
}
.privacy-note {
  margin-top: 4px;
}

@media (max-width: 1080px) {
  .shared-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 720px) {
  .trow {
    grid-template-columns: minmax(0, 1fr);
  }
  .trow-l {
    border-right: 0;
    border-bottom: 1px solid var(--line);
    padding-right: 0;
    padding-bottom: 10px;
  }
  .readonly-banner span {
    margin-left: 0;
    width: 100%;
  }
}

@media print {
  :global(body:has(.shared-plan-page)) {
    background: #fff !important;
    color: #000 !important;
  }
  :global(:has(> .frame .shared-plan-page) > :not(.frame)),
  :global(.frame:has(.shared-plan-page) > :not(.column)),
  :global(.column:has(.shared-plan-page) > :not(#main)) {
    display: none !important;
  }
  :global(.frame-app:has(.shared-plan-page)) {
    display: block !important;
    min-height: 0 !important;
  }
  :global(#main:has(.shared-plan-page)) {
    padding: 0 !important;
  }
  .no-print {
    display: none !important;
  }
  .shared-plan-page {
    max-width: none;
    gap: 12px;
    color: #000;
  }
  .shared-layout {
    grid-template-columns: minmax(0, 1fr) !important;
    gap: 14px;
  }
  .card,
  .trow,
  .ptile,
  .vitem,
  .callout,
  .readonly-banner,
  .cov-item {
    box-shadow: none !important;
    border-color: #999 !important;
    background: #fff !important;
    color: #000 !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .trow,
  .vitem,
  .cov-item,
  .coverage-card {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
</style>
