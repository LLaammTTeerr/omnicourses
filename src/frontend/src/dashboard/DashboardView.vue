<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { fetchAcademicCalendar, type CalendarEvent } from '../calendar/api.js';
import { GROUPS } from '../groups.js';
import { LANGUAGES, useLocale, useMessages } from '../locale.js';
import { fetchNotifications, type Notification } from '../notifications/api.js';
import { NOTIFICATION_MESSAGES } from '../notifications/messages.js';
import { fetchOnboarding, type Onboarding } from '../onboarding/api.js';
import { usePageTitle } from '../page-title.js';
import { fetchPlan, fetchPlanIssues, fetchPlans, type Plan, type PlanIssues } from '../plans/api.js';
import { reducedMotion } from '../plans/flip.js';
import { readLastPlan } from '../plans/last-plan.js';
import Icon from '../shell/Icon.vue';
import type { IconName } from '../shell/icons.js';
import { currentTermNow, termKey } from '../terms.js';
import { useAuth } from '../auth/store.js';
import AuditGate from '../audit/AuditGate.vue';
import { fetchAuditAsOf, type DegreeAudit } from '../audit/api.js';
import { calendarEnd, Dashboard, DONUT, scaleOf, segments, SPARK, sparkPoints, termShort, type RowState, type Snapshot } from './dashboard.js';
import { DASHBOARD_MESSAGES } from './messages.js';
import { AUDIT_MESSAGES } from '../audit/messages.js';
import { conditionAnchor, conditionLabel, useAudit } from '../audit/present.js';

const locale = useLocale();
const m = useMessages(DASHBOARD_MESSAGES);
const am = useMessages(AUDIT_MESSAGES);
const nm = useMessages(NOTIFICATION_MESSAGES);
const auth = useAuth();
const { status, data, error, reload, audit } = useAudit();

usePageTitle(() => am.value.dashboardTitle);

const NOTIFICATIONS_SHOWN = 10;
const SPARK_MARGIN = 0.5;
const CENTER_SWAP_MS = 110;
const LEAVE_ARC_MS = 90;
const LEAVE_DOT_MS = 120;
const INTRO_MS = 700;
const COUNT_MS = 500;
const TIP_OFFSET = 16;
const TIP_EDGE = 8;
const INTRO_KEY = 'oc-dashboard-intro';
const LANGUAGE_CONDITION = 'foreign_language_standard';
const CHECKED_ELSEWHERE = /^(group|combined):|^total_credits$/;

interface Extras {
  plan: Plan | null;
  issues: PlanIssues | null;
  notifications: Notification[];
  calendar: CalendarEvent[];
  targetGraduationTerm: Onboarding['targetGraduationTerm'];
}

const extras = shallowRef<Extras | null>(null);

const settled = async <T,>(p: Promise<T>): Promise<T | null> => {
  try {
    return await p;
  } catch {
    return null;
  }
};

async function loadPlan(): Promise<{ plan: Plan | null; issues: PlanIssues | null }> {
  const list = await settled(fetchPlans());
  const plans = list?.plans ?? [];
  const last = readLastPlan();
  const chosen = plans.find((p) => p.id === last) ?? [...plans].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!chosen) return { plan: null, issues: null };
  const [plan, issues] = await Promise.all([settled(fetchPlan(chosen.id)), settled(fetchPlanIssues(chosen.id))]);
  return { plan, issues };
}

async function loadExtras(): Promise<void> {
  const [planned, notifications, calendar, onboarding] = await Promise.all([
    loadPlan(),
    settled(fetchNotifications(NOTIFICATIONS_SHOWN)),
    settled(fetchAcademicCalendar()),
    settled(fetchOnboarding()),
  ]);
  extras.value = {
    ...planned,
    notifications: notifications?.notifications ?? [],
    calendar: calendar?.events ?? [],
    targetGraduationTerm: onboarding?.targetGraduationTerm ?? null,
  };
}

const past = shallowRef(new Map<string, DegreeAudit>());
const asked = new Set<string>();

async function loadPast(i: number): Promise<void> {
  const term = dash.value?.history[i]?.term;
  if (!term || asked.has(termKey(term))) return;
  asked.add(termKey(term));
  const answer = await settled(fetchAuditAsOf(term));
  if (answer) past.value = new Map(past.value).set(termKey(term), answer);
  else asked.delete(termKey(term));
}

const dash = computed(() =>
  audit.value
    ? new Dashboard({ audit: audit.value, past: past.value, plan: extras.value?.plan ?? null, today: currentTermNow() })
    : null,
);

const sel = ref(0);
const view = ref(0);
watch(
  () => dash.value?.nowIndex,
  (now) => {
    if (now === undefined) return;
    sel.value = now;
    view.value = now;
  },
  { immediate: true },
);

const lang = computed(() => locale.lang);
const held = shallowRef<Snapshot | null>(null);
const snap = computed(() => {
  const next = dash.value?.snapshot(Math.min(view.value, dash.value.nowIndex), lang.value) ?? null;
  return next ?? (dash.value ? held.value : null);
});
watch(snap, (s) => (held.value = s));
watch(view, (i) => void loadPast(i));
const segs = computed(() => (snap.value ? segments(snap.value.rows) : []));
const strip = computed(() => dash.value?.strip(lang.value) ?? []);
const colours = computed(() => [...new Set(dash.value?.rows.map((r) => r.colour) ?? [])]);
const history = computed(() => dash.value?.history ?? []);
const nowIndex = computed(() => dash.value?.nowIndex ?? 0);

const fixed = (digits: number) => new Intl.NumberFormat(LANGUAGES[locale.lang].tag, { minimumFractionDigits: digits, maximumFractionDigits: digits });
const score = (v: number) => fixed(2).format(v);
const grade = (v: number) => fixed(1).format(v);
const shortGrade = (v: number) => new Intl.NumberFormat(LANGUAGES[locale.lang].tag, { maximumFractionDigits: 1 }).format(v);

const shortName = (state: RowState) => {
  const shared = (dash.value?.rows ?? []).filter((r) => r.colour === state.row.colour).length > 1;
  return shared ? state.row.name : (GROUPS.find((g) => g.id === state.row.colour)?.short[locale.lang] ?? state.row.name);
};

const plannerTo = computed(() => (extras.value?.plan ? { name: 'plan', params: { id: extras.value.plan.id } } : { name: 'plans' }));
const auditTo = (hash: string | null) => ({ name: 'audit', ...(hash && { hash }) });

const intro = ref(false);
const k = ref(1);
const count = (v: number) => Math.round(v * k.value);
const countScore = (v: number) => score(v * k.value);

const focus = ref<string | null>(null);
const centerKey = ref<string | null>(null);
const swapping = ref(false);
let swapTimer: ReturnType<typeof setTimeout> | undefined;
watch(focus, (key) => {
  if (centerKey.value === key && !swapping.value) return;
  swapping.value = true;
  clearTimeout(swapTimer);
  swapTimer = setTimeout(() => {
    centerKey.value = key;
    swapping.value = false;
  }, CENTER_SWAP_MS);
});
const centerRow = computed(() => snap.value?.rows.find((r) => r.row.key === centerKey.value) ?? null);

const tip = ref({ show: false, x: 0, y: 0 });
const tipEl = ref<HTMLElement | null>(null);
const tipRow = computed(() => snap.value?.rows.find((r) => r.row.key === focus.value) ?? null);
let leaveTimer: ReturnType<typeof setTimeout> | undefined;
let shownArc: string | null = null;

function clearArc(): void {
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    shownArc = null;
    tip.value.show = false;
    focus.value = null;
  }, LEAVE_ARC_MS);
}

function placeTip(e: PointerEvent): void {
  const w = tipEl.value?.offsetWidth ?? 0;
  const h = tipEl.value?.offsetHeight ?? 0;
  let x = e.clientX + TIP_OFFSET;
  let y = e.clientY + TIP_OFFSET;
  if (x + w > innerWidth - TIP_EDGE) x = e.clientX - w - TIP_OFFSET;
  if (y + h > innerHeight - TIP_EDGE) y = e.clientY - h - TIP_OFFSET;
  tip.value = { show: true, x, y };
}

function onDonutMove(e: PointerEvent): void {
  const arc = (e.target as Element).closest<SVGGElement>('.arc');
  if (!arc) {
    if (shownArc) clearArc();
    return;
  }
  clearTimeout(leaveTimer);
  if (shownArc !== arc.dataset.g) {
    shownArc = arc.dataset.g ?? null;
    focus.value = shownArc;
  }
  placeTip(e);
}

function onGroupsOver(e: MouseEvent): void {
  const g = (e.target as Element).closest<HTMLElement>('.db-g');
  if (g && g.dataset.g !== shownArc) {
    shownArc = g.dataset.g ?? null;
    focus.value = shownArc;
  }
}

function onGroupsLeave(): void {
  shownArc = null;
  focus.value = null;
}

const open = ref(new Set<string>());
function onToggle(key: string, e: Event): void {
  const next = new Set(open.value);
  if ((e.target as HTMLDetailsElement).open) next.add(key);
  else next.delete(key);
  open.value = next;
}

function show(i: number): void {
  view.value = i;
}

function pick(i: number): void {
  sel.value = Math.max(0, Math.min(nowIndex.value, i));
  view.value = sel.value;
}

let back: ReturnType<typeof setTimeout> | undefined;
function onPreviewOver(e: MouseEvent): void {
  const a = (e.target as Element).closest<HTMLElement | SVGElement>('[data-hi]');
  clearTimeout(back);
  if (a) show(Number(a.dataset.hi));
  else back = setTimeout(() => show(sel.value), LEAVE_DOT_MS);
}

function onPreviewLeave(): void {
  clearTimeout(back);
  back = setTimeout(() => show(sel.value), LEAVE_DOT_MS);
}

function onPreviewClick(e: MouseEvent): void {
  const a = (e.target as Element).closest<HTMLElement | SVGElement>('[data-hi]');
  if (!a) return;
  e.preventDefault();
  pick(Number(a.dataset.hi));
}

const pickerOpen = ref(false);
const picker = ref<HTMLElement | null>(null);
const pickerButton = ref<HTMLButtonElement | null>(null);
const pickerItems = computed(() =>
  [...history.value.map((h, i) => ({ i, h })), { i: nowIndex.value, h: null }].reverse(),
);

async function setPicker(on: boolean): Promise<void> {
  pickerOpen.value = on;
  if (!on) return;
  await nextTick();
  picker.value?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
}

function choose(i: number): void {
  void setPicker(false);
  pick(i);
  pickerButton.value?.focus();
}

function onPickerKey(e: KeyboardEvent): void {
  const list = [...(picker.value?.querySelectorAll<HTMLButtonElement>('[data-pick]') ?? [])];
  const at = list.indexOf(document.activeElement as HTMLButtonElement);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    e.stopPropagation();
    const next = list[Math.max(0, Math.min(list.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))];
    next?.focus();
    if (next) show(Number(next.dataset.pick));
  }
  if (e.key === 'Escape') {
    e.stopPropagation();
    void setPicker(false);
    show(sel.value);
    pickerButton.value?.focus();
  }
}

function onDocumentClick(e: MouseEvent): void {
  if (pickerOpen.value && !(e.target as Element).closest('.db-tpick-wrap')) {
    void setPicker(false);
    show(sel.value);
  }
}

function onScrubberKey(e: KeyboardEvent): void {
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || pickerOpen.value) return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  pick(sel.value + (e.key === 'ArrowLeft' ? -1 : 1));
  if (sel.value === 0 || sel.value === nowIndex.value) pickerButton.value?.focus();
}

const hi = computed(() => (snap.value?.live ? nowIndex.value - 1 : view.value));
const cumValues = computed(() => history.value.map((h) => h.cumulativeAccumulatedAverage));
const gpaNow = computed(() => (snap.value?.live ? audit.value?.gpa.accumulatedAverage : snap.value?.summary?.cumulativeAccumulatedAverage) ?? null);
const delta = computed(() => dash.value?.gpaChange(hi.value) ?? null);
const spark = computed(() => {
  const plotted = cumValues.value.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (plotted.length === 0) return null;
  const [lo, hiV] = scaleOf(plotted.map((p) => p.v), SPARK_MARGIN);
  const pts = sparkPoints(plotted.map((p) => p.v), lo, hiV).map((pt, n) => ({ ...pt, i: plotted[n]!.i }));
  return { pts, line: pts.map((p) => `${p.x},${p.y}`).join(' ') };
});

const target = computed(() => extras.value?.targetGraduationTerm ?? null);
const targetEnd = computed(() => (target.value && extras.value ? calendarEnd(extras.value.calendar, target.value) : null));
const remaining = computed(() => (snap.value ? dash.value?.auditAt(snap.value.index)?.credits.remaining ?? null : null));

interface AttentionItem {
  tone: 'bad' | 'warn' | 'info';
  mark: { count: number } | { icon: IconName };
  title: string;
  cta: string;
  to: object;
}

const attention = computed<AttentionItem[]>(() => {
  const a = audit.value;
  if (!a) return [];
  const items: AttentionItem[] = [];
  const violations = extras.value?.issues?.issues.filter((i) => i.kind === 'violation').length ?? 0;
  if (violations) items.push({ tone: 'bad', mark: { count: violations }, title: m.value.violations(violations), cta: m.value.fixInPlan, to: plannerTo.value });
  const language = [...a.graduation.unmet, ...a.graduation.notChecked].find((c) => c.id === LANGUAGE_CONDITION);
  if (language) {
    const unmet = language.status === 'not_met';
    items.push({ tone: 'warn', mark: { icon: 'flag' }, title: unmet ? m.value.noLanguageCertificate : m.value.languageNotChecked, cta: unmet ? m.value.seeCondition : m.value.certificateUnknown, to: auditTo(conditionAnchor(language)) });
  }
  for (const c of a.graduation.unmet.filter((c) => c.id !== LANGUAGE_CONDITION && !CHECKED_ELSEWHERE.test(c.id))) {
    items.push({ tone: 'warn', mark: { icon: 'flag' }, title: conditionLabel(a, c, am.value), cta: m.value.seeCondition, to: auditTo(conditionAnchor(c)) });
  }
  const slots = dash.value?.slotCredits() ?? 0;
  if (slots) items.push({ tone: 'warn', mark: { icon: 'plus' }, title: m.value.unchosenElectives(slots), cta: m.value.chooseCourse, to: plannerTo.value });
  for (const n of extras.value?.notifications ?? []) {
    if (n.readAt || n.links.length === 0) continue;
    const link = n.links[0]!;
    const to = link === 'planner' ? plannerTo.value : { name: link === 'calendar' ? 'calendar' : 'audit' };
    items.push({ tone: 'info', mark: { icon: n.kind === 'transcript_changed' ? 'file' : 'calendar' }, title: nm.value.kinds[n.kind], cta: nm.value.links[link], to });
  }
  return items;
});

function playIntro(): void {
  if (reducedMotion()) return;
  try {
    if (sessionStorage.getItem(INTRO_KEY)) return;
    sessionStorage.setItem(INTRO_KEY, '1');
  } catch {}
  intro.value = true;
  setTimeout(() => (intro.value = false), INTRO_MS);
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);
  const t0 = performance.now();
  k.value = 0;
  const step = (now: number) => {
    k.value = ease(Math.min(1, (now - t0) / COUNT_MS));
    if (k.value < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const ready = computed(() => dash.value !== null && extras.value !== null);
watch(ready, (on) => {
  if (!on) return;
  void nextTick(playIntro);
  history.value.forEach((_, i) => void loadPast(i));
});

onMounted(() => {
  void loadExtras();
  document.addEventListener('click', onDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  clearTimeout(swapTimer);
  clearTimeout(leaveTimer);
  clearTimeout(back);
});
</script>

<template>
  <div :class="['page', 'dashboard-page', { 'db-past': snap && !snap.live, 'db-intro': intro }]">
    <header class="db-head">
      <div>
        <h1>{{ am.dashboardTitle }}</h1>
        <p v-if="audit" class="db-who" data-test="who">
          <template v-for="(part, i) in [auth.user?.displayName, auth.user?.className, auth.user?.studentId].filter(Boolean)" :key="i">
            <span v-if="i" class="sep" aria-hidden="true">·</span><span>{{ part }}</span>
          </template>
        </p>
      </div>
      <div v-if="dash && snap" class="db-scrub-wrap">
        <button v-if="sel !== nowIndex" class="btn sm ghost" type="button" data-test="back-to-now" @click="pick(nowIndex)"><Icon name="undo" />{{ m.backToNow }}</button>
        <div class="db-scrub" role="group" :aria-label="m.viewTerm" @keydown="onScrubberKey">
          <span class="sr-only" role="status">{{ termShort(snap.term, locale.lang) }}{{ snap.live ? m.now : '' }}</span>
          <button type="button" :aria-label="m.previousTerm" :disabled="sel === 0" data-test="previous-term" @click="pick(sel - 1)"><Icon name="left" /></button>
          <span class="db-tpick-wrap">
            <button
              ref="pickerButton"
              type="button"
              class="lb"
              aria-haspopup="listbox"
              :aria-expanded="pickerOpen"
              aria-controls="db-tpick"
              data-test="term-label"
              @click="setPicker(!pickerOpen)"
            >
              {{ termShort(snap.term, locale.lang) }}{{ snap.live ? m.now : '' }}<small v-if="view !== sel">{{ m.preview }}</small>
            </button>
            <span
              id="db-tpick"
              ref="picker"
              :class="['db-tpick', { open: pickerOpen }]"
              role="listbox"
              :aria-label="m.chooseTerm"
              @click="(e) => { const b = (e.target as Element).closest<HTMLElement>('[data-pick]'); if (b) choose(Number(b.dataset.pick)); }"
              @mouseover="(e) => { const b = (e.target as Element).closest<HTMLElement>('[data-pick]'); if (b) show(Number(b.dataset.pick)); }"
              @mouseleave="show(sel)"
              @keydown="onPickerKey"
            >
              <template v-if="pickerOpen">
                <button v-for="{ i, h } in pickerItems" :key="i" type="button" role="option" :data-pick="i" :aria-selected="i === sel">
                  <b>{{ termShort(dash.termAt(i), locale.lang) }}</b>
                  <span>{{ h ? (h.average !== null ? m.gpaOf(score(h.average)) : '—') : m.inProgressShort }}</span>
                  <em v-if="!h">{{ m.current }}</em>
                  <span v-else class="t3">{{ m.cr(h.cumulativeTowardTotal) }}</span>
                </button>
              </template>
            </span>
          </span>
          <button type="button" :aria-label="m.nextTerm" :disabled="sel === nowIndex" data-test="next-term" @click="pick(sel + 1)"><Icon name="right" /></button>
        </div>
      </div>
    </header>

    <AuditGate :status="status" :data="data" :error="error" @retry="reload">
      <template #default="{ audit: a }">
        <template v-if="dash && snap">
          <section class="card db-top" :aria-label="m.progress">
            <div :class="['db-donut', { focus: focus !== null }]" data-test="donut" @pointermove="onDonutMove" @pointerleave="clearArc">
              <svg
                viewBox="0 0 200 200"
                role="img"
                :aria-label="m.donutLabel(snap.passed, a.credits.totalRequired, snap.rows.map((x) => m.donutPart(x.row.name, x.d, x.row.required)).join(', '))"
              >
                <defs>
                  <pattern v-for="c in colours" :id="`db-hatch-${c}`" :key="c" :class="`g-${c}`" patternUnits="userSpaceOnUse" width="9.35" height="9.35" patternTransform="rotate(45)">
                    <rect class="pa" width="9.35" height="9.35" /><rect class="pb" width="4.25" height="9.35" />
                  </pattern>
                </defs>
                <mask id="db-sweep"><circle class="sweep" cx="100" cy="100" :r="DONUT.sweepRadius" pathLength="100" transform="rotate(-90 100 100)" /></mask>
                <g mask="url(#db-sweep)">
                  <g v-for="(s, i) in segs" :key="i" :class="['arc', `g-${s.state.row.colour}`, { on: focus === s.state.row.key }]" :data-g="s.state.row.key">
                    <path v-if="s.kind === 'd'" class="solid" :d="s.path" />
                    <path v-else-if="s.kind === 'c'" :d="s.path" :style="{ fill: `url(#db-hatch-${s.state.row.colour})` }" />
                    <path v-else class="air" :d="s.path" />
                    <path class="hit" :d="s.hit" aria-hidden="true" @click="$router.push(auditTo(s.state.row.hash))" />
                  </g>
                </g>
              </svg>
              <div :class="['db-center', { swap: swapping }]">
                <template v-if="centerRow">
                  <small>{{ shortName(centerRow) }}</small><b>{{ count(centerRow.d) }}</b><span>{{ m.ofCredits(centerRow.row.required) }}</span>
                </template>
                <template v-else>
                  <b data-test="credits-toward-total">{{ count(snap.passed) }}</b><span>{{ m.ofCredits(a.credits.totalRequired) }}</span>
                </template>
              </div>
            </div>
            <div class="db-side">
              <div class="db-row" data-test="row1" @mouseover="onPreviewOver" @mouseleave="onPreviewLeave" @click="onPreviewClick">
                <div class="db-stat wide">
                  <div>
                    <div class="v" data-test="gpa-accumulated-average">{{ gpaNow === null ? '—' : countScore(gpaNow) }}<small>/10</small></div>
                    <div class="k">{{ m.cumulativeGpa }}</div>
                  </div>
                  <div class="end">
                    <span v-if="delta" :class="['delta', delta.change >= 0 ? 'up' : 'down']" :title="m.comparedWith(termShort(delta.since, locale.lang))" data-test="gpa-change">
                      {{ delta.change >= 0 ? '▲ ' : '▼ ' }}{{ score(Math.abs(delta.change)) }}
                    </span>
                    <svg
                      v-if="spark"
                      class="db-spark"
                      :width="SPARK.width + 2 * SPARK.bleed"
                      :height="SPARK.height"
                      :viewBox="`-${SPARK.bleed} 0 ${SPARK.width + 2 * SPARK.bleed} ${SPARK.height}`"
                      aria-hidden="true"
                    >
                      <polyline :points="spark.line" fill="none" style="stroke: var(--info)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" />
                      <g v-for="p in spark.pts" :key="p.i" :data-hi="p.i" :class="{ on: p.i === hi }">
                        <circle class="hit" :cx="p.x" :cy="p.y" :r="SPARK.hit" />
                        <circle class="dot" :cx="p.x" :cy="p.y" :r="p.i === hi ? SPARK.dotOn : SPARK.dot" />
                      </g>
                    </svg>
                  </div>
                </div>
                <div v-if="snap.live && target" class="db-stat" :title="m.termSection(target)" data-test="target-graduation">
                  <div>
                    <div class="v">{{ m.targetTerm(target) }}</div>
                    <div class="k">{{ m.targetGraduation }}</div>
                  </div>
                  <div v-if="targetEnd" class="end"><span class="small t3">{{ targetEnd }}</span></div>
                </div>
                <div v-else-if="!snap.live" class="db-stat" data-test="term-gpa">
                  <div>
                    <div class="v">{{ snap.summary?.average == null ? '—' : countScore(snap.summary.average) }}<small>/10</small></div>
                    <div class="k">{{ m.termGpa }}</div>
                  </div>
                </div>
              </div>
              <div class="db-row" data-test="row2" @mouseover="onPreviewOver" @mouseleave="onPreviewLeave" @click="onPreviewClick">
                <div class="db-stat">
                  <div>
                    <div class="v"><span data-test="credits-remaining">{{ remaining === null ? '—' : count(remaining) }}</span><small v-if="remaining !== null">{{ m.creditUnit }}</small></div>
                    <div class="k">{{ m.leftToGraduate }}</div>
                  </div>
                  <div class="end">
                    <span class="small t3" data-test="credits-in-progress">{{ snap.live ? m.inProgressCredits(a.credits.inProgressTowardTotal) : m.inTermCredits(snap.summary?.credits ?? 0) }}</span>
                  </div>
                </div>
              </div>
              <div class="db-key">
                <RouterLink
                  v-for="x in snap.rows"
                  :key="x.row.key"
                  :class="[`g-${x.row.colour}`, { on: focus === x.row.key }]"
                  :data-g="x.row.key"
                  :to="auditTo(x.row.hash)"
                  :title="x.row.name"
                  @mouseenter="focus = x.row.key"
                  @focus="focus = x.row.key"
                  @mouseleave="focus = null"
                  @blur="focus = null"
                >
                  <i></i><span>{{ shortName(x) }}</span>
                </RouterLink>
              </div>
            </div>
          </section>

          <div class="db-main">
            <section class="card" aria-labelledby="db-g-title">
              <div class="db-sec-head">
                <h2 id="db-g-title">{{ m.groupsTitle }}</h2>
                <div class="db-legend">
                  <span><i></i>{{ m.passed }}</span><span><i class="cur"></i>{{ m.inProgress }}</span><span><i class="left"></i>{{ m.left }}</span>
                </div>
              </div>
              <div :class="['db-groups', { focus: focus !== null }]" @mouseover="onGroupsOver" @mouseleave="onGroupsLeave">
                <details
                  v-for="x in snap.rows"
                  :key="x.row.key"
                  :class="['db-g', `g-${x.row.colour}`, { on: focus === x.row.key }]"
                  :data-g="x.row.key"
                  :open="open.has(x.row.key)"
                  data-test="group"
                  :data-group="x.row.key"
                  @toggle="onToggle(x.row.key, $event)"
                >
                  <summary>
                    <span class="nm">{{ x.row.name }}</span>
                    <span class="cnt" data-test="group-credits"><b>{{ count(x.d) }}</b>/{{ x.row.required }}</span>
                    <span class="db-bar" role="img" :aria-label="m.barLabel(x.d, x.c, x.left, x.row.required)">
                      <i class="d" :style="{ width: `${(Math.min(x.d, x.row.required) / x.row.required) * 100}%` }"></i>
                      <i v-if="x.c" class="c" :style="{ width: `${(x.c / x.row.required) * 100}%` }"></i>
                    </span>
                    <Icon name="down" size="sm" class="chev" />
                  </summary>
                  <div class="db-spoil">
                    <div v-if="x.cur.length" class="db-sec">
                      <h4><span>{{ m.inProgress }}</span><span>{{ m.credits(x.c) }}</span></h4>
                      <div v-for="c in x.cur" :key="c.code" class="db-item">
                        <span class="sq cur"></span><span class="n">{{ c.name }}<template v-if="c.retaken"> <span class="chip bad">{{ m.retake }}</span></template></span><span class="cd">{{ c.code }}</span><span class="r">{{ m.cr(c.credits) }}</span>
                      </div>
                    </div>
                    <div v-if="x.fail.length" class="db-sec">
                      <h4><span>{{ m.failed }}</span><span>{{ m.credits(x.fail.reduce((t, c) => t + c.credits, 0)) }}</span></h4>
                      <div v-for="c in x.fail" :key="c.code" class="db-item">
                        <span class="sq fail"></span><span class="n">{{ c.name }}</span><span class="cd">{{ c.code }}</span><span class="r">{{ c.grade === null ? '—' : m.grade(grade(c.grade)) }}</span>
                      </div>
                    </div>
                    <div v-for="t in x.todo" :key="`${t.term.year}-${t.term.number}`" class="db-sec">
                      <h4><span>{{ m.termSection(t.term) }}</span><span>{{ m.credits(t.credits) }}</span></h4>
                      <template v-for="(c, n) in t.lines" :key="n">
                        <div v-if="'slot' in c" class="db-item"><span class="sq todo"></span><span class="n t3">{{ m.slot }}</span><span class="cd">—</span><span class="r">{{ m.cr(c.credits) }}</span></div>
                        <div v-else class="db-item">
                          <span class="sq todo"></span><span class="n">{{ c.name }}<template v-if="c.retaken"> <span class="chip bad">{{ m.retake }}</span></template></span><span class="cd">{{ c.code }}</span><span class="r">{{ m.cr(c.credits) }}</span>
                        </div>
                      </template>
                    </div>
                    <div v-if="x.unplaced" class="db-sec">
                      <h4><span>{{ m.notInPlan }}</span><span>{{ m.credits(x.unplaced) }}</span></h4>
                      <p class="db-none">{{ m.dragMore(shortName(x), x.row.required) }}</p>
                    </div>
                    <div v-if="x.done.length" class="db-sec">
                      <h4><span>{{ m.passed }}</span><span>{{ m.credits(x.d) }}</span></h4>
                      <div v-for="c in x.done" :key="c.code" class="db-item">
                        <span class="sq"></span><span class="n">{{ c.name }}<template v-if="c.retaken"> <span class="chip bad">{{ m.retake }}</span></template></span><span class="cd">{{ c.code }}</span><span class="r">{{ c.grade === null ? '—' : m.grade(shortGrade(c.grade)) }}</span>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </section>

            <div class="db-aside">
              <section class="card" aria-labelledby="db-term-title" data-test="term-card">
                <div class="db-sec-head">
                  <h2 id="db-term-title">{{ m.termSection(snap.term) }}</h2>
                  <span class="meta">{{ snap.live ? m.inProgressCredits(a.credits.inProgressTowardTotal) : m.termMeta(snap.summary?.average == null ? '—' : score(snap.summary.average), snap.summary?.credits ?? 0) }}</span>
                </div>
                <div class="db-cur">
                  <RouterLink v-for="(c, i) in snap.courses" :key="`${c.code}-${i}`" :class="['row', { g4: !snap.live || !c.inProgress }, `g-${c.colour}`]" :to="auditTo(c.rowHash)">
                    <span :class="['sq', { cur: c.inProgress, fail: c.failed }]"></span><span>{{ c.name }}</span><span class="cd">{{ c.code }}</span>
                    <b v-if="!snap.live || !c.inProgress" class="gr">{{ c.grade === null ? '—' : grade(c.grade) }}</b>
                  </RouterLink>
                </div>
              </section>
              <section class="card" aria-labelledby="db-attn-title" data-test="attention">
                <div class="db-sec-head"><h2 id="db-attn-title">{{ snap.live ? m.attention : m.termSummary }}</h2></div>
                <div class="db-attn">
                  <template v-if="snap.live">
                    <RouterLink v-for="(item, i) in attention" :key="i" :class="item.tone" :to="item.to">
                      <span class="tl"><span v-if="'count' in item.mark">{{ item.mark.count }}</span><Icon v-else :name="item.mark.icon" size="sm" /></span>
                      <span class="copy"><b>{{ item.title }}</b><small>{{ item.cta }}</small></span>
                      <Icon name="chev" size="sm" class="chev" />
                    </RouterLink>
                  </template>
                  <template v-else>
                    <dl class="db-sum">
                      <dt>{{ m.termGpa }}</dt><dd>{{ snap.summary?.average == null ? '—' : score(snap.summary.average) }}</dd>
                      <dt>{{ m.cumulativeAverage }}</dt><dd data-test="term-cumulative">{{ snap.summary?.cumulativeAccumulatedAverage == null ? '—' : score(snap.summary.cumulativeAccumulatedAverage) }}<span v-if="snap.summary?.cumulativeClassification" class="t3"> · {{ am.classifications[snap.summary.cumulativeClassification] }}</span></dd>
                      <dt>{{ m.earned }}</dt><dd>{{ snap.passed }} / {{ a.credits.totalRequired ?? '—' }}</dd>
                      <dt>{{ m.yearLevel }}</dt><dd data-test="term-year-level">{{ snap.summary ? m.yearNumber(snap.summary.cumulativeYearLevel) : '—' }}</dd>
                    </dl>
                    <button class="btn sm" type="button" @click="pick(nowIndex)"><Icon name="undo" size="sm" />{{ m.backToNow }}</button>
                  </template>
                </div>
              </section>
            </div>
          </div>

          <section class="card db-terms-card" aria-labelledby="db-t-title">
            <div class="db-sec-head">
              <h2 id="db-t-title">{{ m.byTerm }}</h2>
              <RouterLink class="meta" :to="{ name: 'transcript' }">{{ m.importTranscript }}</RouterLink>
            </div>
            <div class="db-terms-wrap">
              <div class="db-terms" data-test="terms" @mouseover="onPreviewOver" @mouseleave="onPreviewLeave" @click="onPreviewClick">
                <RouterLink
                  v-for="t in strip"
                  :key="`${t.term.year}-${t.term.number}`"
                  :class="['db-term', { now: t.now, sel: t.index !== null && t.index === view }]"
                  :to="plannerTo"
                  :data-hi="t.index ?? undefined"
                  :aria-label="m.termAria(termShort(t.term, locale.lang), t.credits)"
                >
                  <span class="cells">
                    <template v-for="(c, n) in t.cells" :key="n">
                      <i v-for="u in c.credits" :key="u" :class="[`g-${c.colour}`, { fail: c.state === 'fail', cur: c.state === 'cur', todo: c.state === 'todo' }]" :title="c.code ? m.cellTitle(c.code, c.name, c.credits) : undefined"></i>
                    </template>
                  </span>
                  <span class="lb">{{ termShort(t.term, locale.lang) }}{{ t.now ? m.now : '' }}</span>
                </RouterLink>
                <RouterLink class="db-term grad" :to="{ name: 'audit' }"><span class="cells"><Icon name="flag" /></span><span class="lb">{{ m.graduation }}</span></RouterLink>
              </div>
              <div class="db-terms-key">
                <span v-for="c in colours" :key="c" :class="`g-${c}`"><i></i>{{ GROUPS.find((g) => g.id === c)?.short[locale.lang] }}</span>
                <span class="gap"></span><span><i></i>{{ m.passed }}</span><span><i class="fail"></i>{{ m.failed }}</span><span><i class="cur"></i>{{ m.inProgress }}</span><span><i class="todo"></i>{{ m.planned }}</span>
              </div>
            </div>
          </section>
        </template>
      </template>
    </AuditGate>

    <Teleport to="body">
      <div ref="tipEl" :class="['db-tip', { show: tip.show && tipRow }]" role="tooltip" :aria-hidden="!tip.show" :style="{ transform: `translate(${tip.x}px,${tip.y}px)` }">
        <div v-if="tipRow" :class="`g-${tipRow.row.colour}`">
          <b><i></i>{{ tipRow.row.name }}</b>
          <p><span>{{ m.passed }}</span><span>{{ m.cr(tipRow.d) }}</span></p>
          <p><span>{{ m.inProgress }}</span><span>{{ m.cr(tipRow.c) }}</span></p>
          <p><span>{{ m.left }}</span><span>{{ tipRow.left === null ? '—' : m.cr(tipRow.left) }}</span></p>
          <p><span>{{ m.required }}</span><span>{{ m.cr(tipRow.row.required) }}</span></p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.g-none { --c: var(--ink-3); --on: #fff; }
.dashboard-page .db-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px 20px; flex-wrap: wrap; }
.dashboard-page .db-head h1 { font-size: 28px; }
.db-who { margin: 6px 0 0; color: var(--ink-2); font-size: 14px; display: flex; flex-wrap: wrap; gap: 0 8px; }
.db-who .sep { color: var(--ink-3); }

.dashboard-page .db-top { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: clamp(20px, 3vw, 40px); align-items: center; padding: 18px clamp(16px, 2vw, 24px); }
.db-donut { position: relative; width: clamp(156px, 12vw, 184px); aspect-ratio: 1; }
.db-donut svg { display: block; width: 100%; height: 100%; overflow: visible; }
.db-donut .arc { transform-box: view-box; transform-origin: 100px 100px; transition: transform 0.38s cubic-bezier(0.2, 0.9, 0.25, 1.15), opacity 0.28s ease; }
.db-donut .solid { fill: var(--c); }
.db-donut .air { fill: var(--surface-3); transition: fill 0.28s ease; }
.db-donut .hit { fill: transparent; cursor: pointer; }
.db-donut.focus .arc { opacity: 0.5; }
.db-donut.focus .arc.on { opacity: 1; transform: scale(1.065); }
.db-donut .arc.on .air { fill: color-mix(in oklab, var(--c) 22%, var(--surface-3)); }
.db-donut pattern .pa { fill: var(--c); opacity: 0.22; }
.db-donut pattern .pb { fill: var(--c); }
.db-center { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; pointer-events: none; transition: opacity 0.11s ease, transform 0.11s ease; }
.db-center.swap { opacity: 0; transform: scale(0.96); }
.db-center b { font: 700 clamp(32px, 2.8vw, 40px)/1 var(--display); letter-spacing: -0.035em; font-variant-numeric: tabular-nums; color: color-mix(in oklab, var(--info) 72%, var(--ink)); }
.db-center span { font-size: 12.5px; color: var(--ink-3); margin-top: 4px; }
.db-center small { font-size: 12px; font-weight: 600; color: var(--ink-2); margin-bottom: 2px; }

.db-side { display: grid; gap: 10px; min-width: 0; }
.db-row { display: flex; gap: 10px; }
.db-stat { flex: 1 1 0; min-width: 0; height: 68px; padding: 0 18px; border-radius: 16px; background: var(--surface-2); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.db-stat.wide { flex-grow: 1.45; }
.db-stat .v { font: 650 22px/1.1 var(--display); letter-spacing: -0.025em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.db-stat .v small { font: 500 14px var(--font); color: var(--ink-3); letter-spacing: 0; margin-left: 2px; }
.db-stat .k { font-size: 13px; color: var(--ink-3); white-space: nowrap; margin-top: 5px; }
.db-stat .end { display: flex; align-items: center; gap: 10px; flex: none; }
.db-stat svg { display: block; }
.db-stat > div:first-child { min-width: 0; }
@media (max-width: 1320px) and (min-width: 1101px) { .db-stat svg { display: none; } }
.delta { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; font-weight: 650; padding: 2px 7px; border-radius: 999px; white-space: nowrap; }
.delta.up { color: var(--ok); background: color-mix(in oklab, var(--ok) 12%, var(--surface)); }
.delta.down { color: var(--bad); background: color-mix(in oklab, var(--bad) 11%, var(--surface)); }
.db-key { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2px 12px; }
.db-key a { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--ink-2); text-decoration: none; padding: 4px 6px; border-radius: 6px; min-width: 0; }
.db-key a:hover, .db-key a:focus-visible, .db-key a.on { background: var(--surface-2); color: var(--ink); }
.db-key i { width: 9px; height: 9px; border-radius: 3px; background: var(--c); flex: none; }
.db-key span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.db-tip { position: fixed; left: 0; top: 0; z-index: 80; pointer-events: none; min-width: 190px; padding: 10px 12px; border-radius: 10px; background: var(--ink); color: var(--on-ink); font-size: 12.5px; box-shadow: var(--shadow-lg); opacity: 0; transition: opacity 0.12s; }
.db-tip.show { opacity: 1; }
.db-tip b { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 6px; }
.db-tip b i { width: 10px; height: 10px; border-radius: 3px; background: var(--c); }
.db-tip p { display: flex; justify-content: space-between; gap: 18px; margin: 0; }
.db-tip p span:first-child { opacity: 0.75; }
.db-tip p span:last-child { font-variant-numeric: tabular-nums; font-weight: 600; }

.db-main { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 22px; align-items: start; }
.db-main > * { min-width: 0; }
.dashboard-page .card { padding: 0; }
.dashboard-page .db-top.card { padding: 18px clamp(16px, 2vw, 24px); }
.db-sec-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 20px 22px 8px; flex-wrap: wrap; }
.db-sec-head h2 { font-size: 19px; }
.db-sec-head .meta { font-size: 13px; color: var(--ink-3); white-space: nowrap; }
.db-aside .db-sec-head h2 { font-size: 17px; }
.db-aside .db-sec-head { flex-wrap: nowrap; }
.db-legend { display: flex; gap: 14px; font-size: 12px; color: var(--ink-3); flex-wrap: wrap; }
.db-legend span { display: inline-flex; align-items: center; gap: 6px; }
.db-legend i { width: 14px; height: 8px; border-radius: 2px; background: var(--ink-2); }
.db-legend i.cur { background: repeating-linear-gradient(135deg, var(--ink-2) 0 2px, color-mix(in oklab, var(--ink-2) 20%, transparent) 2px 4.5px); }
.db-legend i.left { background: color-mix(in oklab, var(--ink-2) 20%, transparent); }

.dashboard-page [class*='g-'] {
  --c-air: color-mix(in oklab, var(--c) 20%, transparent);
  --c-half: repeating-linear-gradient(135deg, var(--c) 0 4.25px, var(--c-air) 4.25px 9.35px);
}
.dashboard-page .sq { width: 11px; height: 11px; border-radius: 3px; background: var(--c); flex: none; }
.dashboard-page .sq.cur { background: var(--c-half); }
.dashboard-page .sq.todo { background: var(--c-air); }
.dashboard-page .sq.fail { background: var(--bad); }

.db-groups { padding: 0 12px 12px; }
.db-groups .db-g { transition: opacity 0.2s; }
.db-groups.focus .db-g:not(.on) { opacity: 0.42; }
.db-g.on summary { background: var(--c-soft); }
.db-g summary { list-style: none; display: grid; grid-template-columns: minmax(0, 1fr) 76px minmax(120px, 1.1fr) 20px; gap: 18px; align-items: center; padding: 14px 10px; cursor: pointer; border-radius: 12px; }
.db-g summary::-webkit-details-marker { display: none; }
.db-g summary:hover { background: var(--surface-2); }
.db-g .nm { font-weight: 650; font-size: 15px; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-g .cnt { text-align: right; font-variant-numeric: tabular-nums; color: var(--ink-3); font-size: 14px; white-space: nowrap; }
.db-g .cnt b { font: 650 22px var(--display); color: var(--ink); letter-spacing: -0.02em; }
.db-g .chev { color: var(--ink-3); transition: transform 0.2s; }
.db-g[open] .chev { transform: rotate(180deg); }
.db-bar { height: 10px; border-radius: 999px; background: var(--surface-3); display: flex; overflow: hidden; gap: 2px; }
.db-bar i { display: block; height: 100%; border-radius: 999px; }
.db-bar .d { background: var(--c); }
.db-bar .c { background: var(--c-half); }
.db-spoil { background: var(--surface-2); border-radius: 16px; padding: 4px 22px 12px; margin: 2px 0 12px; }
.db-sec + .db-sec { margin-top: 6px; }
.db-sec h4 { display: flex; justify-content: space-between; gap: 8px; font-size: 13.5px; font-weight: 600; color: var(--ink-2); padding: 16px 0 4px; letter-spacing: 0; }
.db-sec h4 span:last-child { color: var(--ink-3); font-weight: 500; }
.db-item { display: grid; grid-template-columns: 11px minmax(0, 1fr) auto 70px; gap: 12px; align-items: center; padding: 10px 0; font-size: 15px; }
.db-item + .db-item { border-top: 1px solid var(--edge); }
.db-item .n { min-width: 0; }
.db-item .cd { font: 500 13px var(--mono); color: var(--ink-3); white-space: nowrap; }
.db-item .r { text-align: right; white-space: nowrap; font-size: 14px; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.db-item .chip { font-size: 11px; min-height: 0; padding: 0 7px; margin-left: 4px; vertical-align: 1px; }
.db-none { font-size: 14px; color: var(--ink-3); padding: 10px 0; margin: 0; }

.db-aside { display: grid; gap: 22px; }
.db-cur, .db-attn { display: grid; padding: 0 22px 18px; }
.db-cur .row { display: grid; grid-template-columns: 11px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px 0; text-decoration: none; font-size: 15px; color: inherit; }
.db-cur .row.g4 { grid-template-columns: 11px minmax(0, 1fr) auto 34px; }
.db-cur .row + .row { border-top: 1px solid var(--edge); }
.db-cur .row span:nth-child(2) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-cur .row:hover span:nth-child(2) { color: var(--info); }
.db-cur .cd { font: 500 13px var(--mono); color: var(--ink-3); }
.db-cur .gr { text-align: right; font: 650 15px var(--display); font-variant-numeric: tabular-nums; }
.db-attn { gap: 10px; padding-top: 6px; }
.db-attn a { display: grid; grid-template-columns: 40px minmax(0, 1fr) 18px; gap: 14px; align-items: center; padding: 12px 14px; border-radius: 16px; background: var(--surface-2); text-decoration: none; color: inherit; transition: background 0.15s; }
.db-attn a:hover { background: var(--surface-3); }
.db-attn .tl { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; font: 700 18px var(--display); }
.db-attn .bad .tl { background: color-mix(in oklab, var(--bad) 13%, var(--surface)); color: var(--bad); }
.db-attn .warn .tl { background: color-mix(in oklab, var(--eng) 22%, var(--surface)); color: color-mix(in oklab, var(--warn) 85%, var(--ink)); }
.db-attn .info .tl { background: color-mix(in oklab, var(--info) 12%, var(--surface)); color: var(--info); }
.db-attn b { display: block; font-size: 14.5px; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-attn small { display: block; font-size: 13.5px; font-weight: 600; color: var(--info); }
.db-attn .chev { color: var(--ink-3); }
.db-attn .copy { min-width: 0; }
.db-attn > .btn { justify-self: start; }
.db-sum { display: grid; grid-template-columns: auto 1fr; gap: 10px 16px; font-size: 14.5px; margin: 0 0 14px; padding: 6px 0 0; }
.db-sum dt { color: var(--ink-3); }
.db-sum dd { margin: 0; text-align: right; font-weight: 650; font-variant-numeric: tabular-nums; }

.db-terms-wrap { padding: 4px 22px 20px; }
.db-terms { display: flex; gap: 2px; overflow-x: auto; padding: 4px 0 6px; }
.db-term { flex: 1 0 auto; display: grid; grid-template-rows: 1fr auto; gap: 10px; padding: 8px; border-radius: 12px; text-decoration: none; color: var(--ink-3); }
.db-term:hover { background: var(--surface-2); }
.db-term.now { background: color-mix(in oklab, var(--info) 9%, var(--surface)); color: var(--info); }
.db-term.sel { outline: 2px solid var(--info); outline-offset: -2px; }
.db-term[data-hi] { cursor: pointer; }
.db-term .cells { display: grid; grid-template-columns: repeat(5, 11px); grid-auto-rows: 11px; gap: 3px; align-content: start; min-height: 67px; }
.db-term .cells i { border-radius: 3px; background: var(--c); }
.db-term .cells i.cur { background: repeating-linear-gradient(135deg, var(--c) 0 2px, var(--c-half) 2px 4.5px); }
.db-term .cells i.todo { background: var(--c-air); }
.db-term .cells i.fail { background: transparent; box-shadow: inset 0 0 0 1.5px var(--bad); }
.db-term .lb { font-size: 12.5px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.db-term.now .lb { font-weight: 650; }
.db-term.grad { color: var(--ink); }
.db-term.grad .cells { display: grid; place-items: start; color: var(--info); }
.db-term.grad .lb { font-weight: 650; }
.db-terms-key { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 12px; font-size: 13px; color: var(--ink-2); }
.db-terms-key span { display: inline-flex; align-items: center; gap: 7px; }
.db-terms-key i { width: 12px; height: 12px; border-radius: 3px; background: var(--c, var(--ink-3)); }
.db-terms-key i.cur { background: repeating-linear-gradient(135deg, var(--ink-3) 0 2px, color-mix(in oklab, var(--ink-3) 20%, transparent) 2px 4.5px); }
.db-terms-key i.todo { background: color-mix(in oklab, var(--ink-3) 20%, transparent); }
.db-terms-key i.fail { background: transparent; box-shadow: inset 0 0 0 1.5px var(--bad); }
.db-terms-key .gap { flex-basis: 100%; height: 0; }

.db-scrub-wrap { display: flex; align-items: center; gap: 8px; }
.db-scrub { display: flex; align-items: center; gap: 2px; padding: 3px; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--edge); }
.db-scrub button { width: 30px; height: 30px; border: 0; border-radius: 7px; background: none; color: var(--ink-2); display: grid; place-items: center; cursor: pointer; }
.db-scrub button:hover:not(:disabled) { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); }
.db-scrub button:disabled { opacity: 0.35; cursor: default; }
.db-scrub .lb { min-width: 128px; text-align: center; font-size: 13.5px; font-weight: 650; font-variant-numeric: tabular-nums; white-space: nowrap; }
.db-scrub .lb small { display: block; font-size: 11px; font-weight: 600; color: var(--info); line-height: 1; }
.db-past .db-scrub { border-color: color-mix(in oklab, var(--info) 45%, var(--edge)); background: color-mix(in oklab, var(--info) 9%, var(--surface)); }
.db-past .db-scrub .lb { color: var(--info); }
.db-spark g { cursor: pointer; }
.db-spark .hit { fill: transparent; }
.db-spark .dot { fill: var(--surface); stroke: var(--info); stroke-width: 1.6; transition: r 0.15s; }
.db-spark g.on .dot { fill: var(--info); }
.db-spark g:hover .dot { r: 4px; }
.db-tpick-wrap { position: relative; display: inline-flex; }
.db-scrub button.lb { width: auto; min-width: 128px; height: 30px; padding: 0 10px; font: inherit; font-size: 13.5px; font-weight: 650; color: inherit; }
.db-scrub button.lb[aria-expanded='true'] { background: var(--surface); box-shadow: var(--shadow-sm); }
.db-tpick {
  position: absolute; z-index: 40; top: calc(100% + 8px); right: -40px; width: min(270px, calc(100vw - 32px)); max-height: 380px; overflow-y: auto; padding: 6px; display: none;
  background: var(--surface); border: 1px solid var(--edge); border-radius: 14px; box-shadow: var(--shadow-lg); animation: pop 0.16s ease-out;
}
.db-tpick.open { display: grid; gap: 2px; }
.db-scrub .db-tpick button { width: auto; height: auto; display: grid; grid-template-columns: 84px 1fr auto; gap: 8px; align-items: center; padding: 8px 10px; border-radius: 9px; text-align: left; font: 500 13.5px var(--font); color: var(--ink-2); box-shadow: none; }
.db-scrub .db-tpick button:hover, .db-scrub .db-tpick button:focus-visible { background: var(--surface-2); color: var(--ink); box-shadow: none; outline: none; }
.db-scrub .db-tpick button[aria-selected='true'] { background: var(--surface-3); color: var(--ink); }
.db-tpick b { font-weight: 650; color: var(--ink); font-variant-numeric: tabular-nums; }
.db-tpick span { font-variant-numeric: tabular-nums; }
.db-tpick em { font-style: normal; font-size: 11.5px; font-weight: 650; padding: 1px 7px; border-radius: 999px; background: var(--info); color: #fff; }

.sweep { fill: none; stroke: #fff; stroke-width: 60; stroke-dasharray: 100 100; }
.db-intro .sweep { animation: dbsweep 0.5s cubic-bezier(0.3, 0.7, 0.3, 1) both; }
@keyframes dbsweep { from { stroke-dashoffset: 100; } }
.db-intro .db-bar i { animation: dbgrow 0.5s cubic-bezier(0.3, 0.7, 0.3, 1) both; }
@keyframes dbgrow { from { width: 0; } }
.db-intro .db-spark { animation: dbwipe 0.5s cubic-bezier(0.3, 0.7, 0.3, 1) both; }
@keyframes dbwipe { from { clip-path: inset(0 100% 0 0); } }
.db-intro .db-term .cells i { animation: dbpop 0.5s cubic-bezier(0.3, 0.7, 0.3, 1) both; }
@keyframes dbpop { from { opacity: 0; transform: scale(0.4); } }
@keyframes pop { from { transform: scale(0.92) translateY(10px); opacity: 0; } to { transform: none; opacity: 1; } }

@media (max-width: 1180px) {
  .db-main { grid-template-columns: 1fr; }
  .db-aside { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
}
@media (max-width: 1100px) {
  .dashboard-page .db-top { grid-template-columns: 1fr; justify-items: center; }
  .db-side { width: 100%; }
}
@media (max-width: 760px) {
  .db-row { flex-direction: column; }
  .db-stat, .db-stat.wide { flex: none; }
  .db-key { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .db-aside { grid-template-columns: 1fr; }
  .db-tpick { right: auto; left: -30px; }
  .db-groups { padding: 0 6px 8px; }
  .db-g summary { grid-template-columns: minmax(0, 1fr) auto 20px; gap: 8px 12px; }
  .db-g summary .db-bar { grid-column: 1 / -1; grid-row: 2; }
  .db-spoil { padding: 2px 14px 8px; }
  .db-item { grid-template-columns: 11px minmax(0, 1fr) auto; font-size: 14px; }
  .db-item .cd { grid-column: 2; grid-row: 2; margin-top: -6px; }
  .db-item .r { grid-column: 3; grid-row: 1; }
  .db-sec-head, .db-cur, .db-attn { padding-left: 16px; padding-right: 16px; }
  .db-terms-wrap { padding: 0 16px 16px; }
}
</style>
