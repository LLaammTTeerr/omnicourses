<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useAsyncLoad } from '../async-load.js';
import ExternalLink from '../components/ExternalLink.vue';
import { useLocale, useMessages, LANGUAGES } from '../locale.js';
import { usePageTitle } from '../page-title.js';
import Icon from '../shell/Icon.vue';
import { termName, vietnamDate } from '../terms.js';
import { fetchAcademicCalendar, type CalendarEvent, type CalendarEventKind } from './api.js';
import {
  academicYearMonths,
  academicYearOf,
  addDays,
  DAYS_IN_WEEK,
  dayOfMonth,
  daysFromTo,
  eventsByDay,
  isWeekend,
  monthDays,
  monthStart,
  monthWeeks,
  mondayOf,
  sameMonth,
  sundayOf,
  termWeek,
  thursdayOf,
  weekDays as daysOfWeek,
} from './dates.js';
import { CALENDAR_MESSAGES } from './messages.js';

const UPCOMING_SHOWN = 8;
const EVENTS_SHOWN_PER_MONTH_DAY = 3;

const locale = useLocale();
const m = useMessages(CALENDAR_MESSAGES);

const { status, data, reload } = useAsyncLoad('the academic calendar', fetchAcademicCalendar);
const events = computed(() => data.value?.events ?? []);
const program = computed(() => data.value?.program ?? null);

const today = vietnamDate(new Date());
const homeWeek = mondayOf(today);
const homeMonth = monthStart(today);
const mode = ref<'week' | 'month'>('week');
const week = ref(homeWeek);
const month = ref(homeMonth);
const selectedId = ref<string | null>(null);

const weekDays = computed(() => daysOfWeek(week.value));
const days = computed(() => (mode.value === 'week' ? weekDays.value : monthDays(month.value)));
const byDay = computed(() => eventsByDay(events.value, days.value[0]!, days.value.at(-1)!));
const on = (day: string) => byDay.value.get(day) ?? [];
const shownOn = (day: string) => on(day).slice(0, EVENTS_SHOWN_PER_MONTH_DAY);
const hiddenOn = (day: string) => Math.max(0, on(day).length - EVENTS_SHOWN_PER_MONTH_DAY);

function weekOfTerm(monday: string) {
  for (const day of daysOfWeek(monday)) {
    const found = termWeek(day, events.value);
    if (found) return found;
  }
  return null;
}
const shownTermWeek = computed(() => weekOfTerm(week.value));

const weekRange = (monday: string) => `${m.value.day(monday)} – ${m.value.day(sundayOf(monday))}`;
const rangeLabel = computed(() => (mode.value === 'week' ? weekRange(week.value) : m.value.monthName(month.value)));
const subtitle = computed(() => {
  const found = mode.value === 'week' ? shownTermWeek.value : null;
  if (found) return `${termName(found.term, locale.lang)} · ${m.value.weekNumber(found.week)}`;
  return m.value.academicYear(academicYearOf(mode.value === 'week' ? thursdayOf(week.value) : month.value));
});
const atHome = computed(() => (mode.value === 'week' ? week.value === homeWeek : month.value === homeMonth));

function go(n: number): void {
  if (mode.value === 'week') week.value = addDays(week.value, DAYS_IN_WEEK * n);
  else month.value = monthStart(month.value, n);
  void nextTick(showToday);
}
function goHome(): void {
  week.value = homeWeek;
  month.value = homeMonth;
  void nextTick(showToday);
}
const homeWeekIn = (first: string) => sameMonth(homeWeek, first) || sameMonth(sundayOf(homeWeek), first);
function setMode(next: 'week' | 'month'): void {
  if (next === 'month' && mode.value === 'week') month.value = monthStart(thursdayOf(week.value));
  if (next === 'week' && mode.value === 'month') week.value = homeWeekIn(month.value) ? homeWeek : monthWeeks(month.value)[0]!;
  mode.value = next;
  void nextTick(showToday);
}

const scroller = ref<HTMLElement | null>(null);
function centre(box: HTMLElement, cell: HTMLElement): void {
  box.scrollLeft += cell.getBoundingClientRect().left - box.getBoundingClientRect().left - (box.clientWidth - cell.offsetWidth) / 2;
}
function showToday(): void {
  const box = scroller.value;
  if (!box || box.scrollWidth <= box.clientWidth) return;
  const cell = box.querySelector<HTMLElement>(`[data-day="${today}"]`);
  if (cell) centre(box, cell);
  else box.scrollLeft = 0;
}
watch(status, (now) => now === 'loaded' && showToday(), { flush: 'post' });

function openWeek(day: string): void {
  week.value = mondayOf(day);
  mode.value = 'week';
}

const pickerOpen = ref(false);
const pickWrap = ref<HTMLElement | null>(null);
function weekItem(monday: string) {
  const found = weekOfTerm(monday);
  return {
    key: monday,
    label: found ? m.value.weekNumber(found.week) : m.value.day(monday),
    range: weekRange(monday),
    selected: monday === week.value,
    now: monday === homeWeek,
  };
}
const monthItem = (first: string) => ({ key: first, label: m.value.monthName(first), range: '', selected: first === month.value, now: first === homeMonth });
const pickerItems = computed(() =>
  mode.value === 'week' ? monthWeeks(monthStart(thursdayOf(week.value))).map(weekItem) : academicYearMonths(academicYearOf(month.value)).map(monthItem),
);
function pick(key: string): void {
  if (mode.value === 'week') week.value = key;
  else month.value = key;
  pickerOpen.value = false;
}

const KIND_GROUP: Record<CalendarEventKind, string> = {
  term_start: 'g-core',
  term_end: 'g-core',
  registration: 'g-elec',
  add_drop: 'g-elec',
  exam_period: 'g-pol',
  holiday: 'g-gen',
  other: 'g-thesis',
};
const titleOf = (e: CalendarEvent) => (locale.lang === 'en' && e.titleEn ? e.titleEn : e.title);
const otherTitle = (e: CalendarEvent) => (locale.lang === 'en' ? (e.titleEn ? e.title : null) : e.titleEn);
const spanIn = (e: CalendarEvent, format: (iso: string) => string) => (e.startsOn === e.endsOn ? format(e.startsOn) : `${format(e.startsOn)} – ${format(e.endsOn)}`);
const spanOf = (e: CalendarEvent) => spanIn(e, m.value.day);
const termOf = (e: CalendarEvent) => (e.term === null ? m.value.wholeYear(e.academicYear) : m.value.term(e.term, e.academicYear));
const continues = (e: CalendarEvent, day: string) => day !== e.startsOn && day !== week.value;
const ongoing = (e: CalendarEvent) => e.startsOn <= today && e.endsOn >= today;
const firstDayShown = (e: CalendarEvent) => (e.startsOn < today ? today : e.startsOn);

const upcoming = computed(() => events.value.filter((e) => e.endsOn >= today).slice(0, UPCOMING_SHOWN));
const selected = computed(() => events.value.find((e) => e.id === selectedId.value) ?? null);

const inShownWeek = (e: CalendarEvent) => e.endsOn >= week.value && e.startsOn <= sundayOf(week.value);
function select(e: CalendarEvent): void {
  selectedId.value = selectedId.value === e.id ? null : e.id;
  if (selectedId.value && mode.value === 'week' && !inShownWeek(e)) week.value = mondayOf(e.startsOn);
}

const updatedOn = (e: CalendarEvent) => new Intl.DateTimeFormat(LANGUAGES[locale.lang].tag, LANGUAGES[locale.lang].date).format(new Date(e.updatedAt));

function onKey(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  if (pickerOpen.value) pickerOpen.value = false;
  else selectedId.value = null;
}
function onClick(e: MouseEvent): void {
  if (pickerOpen.value && !pickWrap.value?.contains(e.target as Node)) pickerOpen.value = false;
}
onMounted(() => {
  document.addEventListener('keydown', onKey);
  document.addEventListener('click', onClick);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey);
  document.removeEventListener('click', onClick);
});

usePageTitle(() => m.value.title);
</script>

<template>
  <div class="page cal-page">
    <header class="page-head">
      <h1>{{ m.title }}</h1>
      <div class="seg" role="group" :aria-label="m.view">
        <button type="button" :aria-pressed="mode === 'week'" data-test="tab-week" @click="setMode('week')">{{ m.week }}</button>
        <button type="button" :aria-pressed="mode === 'month'" data-test="tab-month" @click="setMode('month')">{{ m.month }}</button>
      </div>
    </header>

    <p v-if="status === 'failed'" class="callout bad" role="alert">
      <Icon name="alert" /><span>{{ m.loadFailed }} <button class="btn sm" type="button" @click="reload">{{ m.retry }}</button></span>
    </p>
    <p v-else-if="status === 'loading'" class="t3">{{ m.loading }}</p>

    <div v-else class="cal-wrap" :class="{ 'with-detail': selected }" :data-mode="mode">
      <section class="cal-main" :aria-label="m.title">
        <div class="cal-bar">
          <div ref="pickWrap" class="cal-pick-wrap">
            <button
              class="cal-pick"
              type="button"
              aria-haspopup="listbox"
              :aria-expanded="pickerOpen"
              aria-controls="cal-picker"
              data-test="range"
              @click="pickerOpen = !pickerOpen"
            >
              <b>{{ rangeLabel }}</b><Icon name="down" />
            </button>
            <p class="cal-subt" data-test="subtitle">{{ subtitle }}</p>
            <div v-if="pickerOpen" id="cal-picker" class="cal-picker" role="listbox" :aria-label="mode === 'week' ? m.pickWeek : m.pickMonth">
              <button
                v-for="item in pickerItems"
                :key="item.key"
                type="button"
                role="option"
                :aria-selected="item.selected"
                :class="{ wide: mode === 'month' }"
                @click="pick(item.key)"
              >
                <b>{{ item.label }}</b><span>{{ item.range }}</span><em v-if="item.now">{{ m.now }}</em>
              </button>
            </div>
          </div>
          <div class="cal-nav">
            <button class="btn sm ghost" type="button" :disabled="atHome" data-test="today" @click="goHome">{{ m.today }}</button>
            <button class="btn sm ghost icon-only" type="button" :aria-label="m.previous" data-test="prev" @click="go(-1)"><Icon name="left" /></button>
            <button class="btn sm ghost icon-only" type="button" :aria-label="m.next" data-test="next" @click="go(1)"><Icon name="right" /></button>
          </div>
        </div>

        <div ref="scroller" class="cal-scroll">
          <div v-if="mode === 'week'" class="cal-week" data-test="week">
            <div v-for="(day, i) in weekDays" :key="day" class="cal-dh" :class="{ today: day === today }">
              <span aria-hidden="true">{{ m.weekdays[i] }}</span><span class="sr-only">{{ m.spokenWeekdays[i] }}</span><b>{{ dayOfMonth(day) }}</b>
            </div>
            <div v-for="day in weekDays" :key="`c${day}`" class="cal-cell" :class="{ today: day === today, weekend: isWeekend(day) }" :data-day="day">
              <button
                v-for="e in on(day)"
                :key="e.id"
                type="button"
                class="cal-ev"
                :class="[KIND_GROUP[e.kind], { exam: e.kind === 'exam_period', cont: continues(e, day), on: e.id === selectedId }]"
                :aria-pressed="e.id === selectedId"
                :title="titleOf(e)"
                data-test="event"
                @click="select(e)"
              >
                <template v-if="continues(e, day)"><i></i><span>{{ titleOf(e) }}</span></template>
                <template v-else>
                  <span class="code"><i></i><span>{{ m.kinds[e.kind] }}</span></span>
                  <b>{{ titleOf(e) }}</b>
                  <span class="room">{{ spanOf(e) }}<template v-if="e.term"> · {{ m.termShort(e.term) }}</template></span>
                </template>
              </button>
            </div>
          </div>

          <div v-else class="cal-month" data-test="month">
            <div v-for="(d, i) in m.weekdays" :key="d" class="cal-mh"><span aria-hidden="true">{{ d }}</span><span class="sr-only">{{ m.spokenWeekdays[i] }}</span></div>
            <div v-for="day in days" :key="day" class="cal-md" :class="{ out: !sameMonth(day, month), today: day === today }" :data-day="day">
              <button type="button" class="n" :aria-label="m.spokenDay(day)" @click="openWeek(day)">{{ dayOfMonth(day) }}</button>
              <button
                v-for="e in shownOn(day)"
                :key="e.id"
                type="button"
                class="cal-chip"
                :class="[KIND_GROUP[e.kind], { on: e.id === selectedId }]"
                :aria-pressed="e.id === selectedId"
                :title="titleOf(e)"
                data-test="event"
                @click="select(e)"
              >
                <i></i>{{ titleOf(e) }}
              </button>
              <button v-if="hiddenOn(day)" type="button" class="more" :aria-label="m.moreLabel(hiddenOn(day), day)" @click="openWeek(day)">{{ m.more(hiddenOn(day)) }}</button>
            </div>
          </div>
        </div>

        <p v-if="program" class="cal-foot"><Icon name="info" />{{ m.foot(program.code) }}</p>
      </section>

      <aside class="card cal-up" :aria-label="m.upcoming">
        <div v-if="selected" class="cal-detail" :class="KIND_GROUP[selected.kind]" data-test="detail">
          <div class="hd">
            <div>
              <p class="eyebrow">{{ m.kinds[selected.kind] }}</p>
              <h2>{{ titleOf(selected) }}</h2>
              <p v-if="otherTitle(selected)" class="small t3">{{ otherTitle(selected) }}</p>
            </div>
            <button class="btn sm ghost icon-only" type="button" :aria-label="m.close" data-test="close" @click="selectedId = null"><Icon name="x" /></button>
          </div>
          <div class="facts">
            <div class="fact">
              <span class="fi"><Icon name="calendar" /></span>
              <div>
                <span class="fl">{{ m.when }}</span>
                <b><span aria-hidden="true">{{ spanIn(selected, m.longDay) }}</span><span class="sr-only">{{ spanIn(selected, m.spokenDay) }}</span></b>
                <small>{{ m.days(daysFromTo(selected.startsOn, selected.endsOn)) }}<template v-if="ongoing(selected)"> · {{ m.ongoing }}</template></small>
              </div>
            </div>
            <div class="fact">
              <span class="fi"><Icon name="cap" /></span>
              <div><span class="fl">{{ m.termLabel }}</span><b>{{ termOf(selected) }}</b></div>
            </div>
            <div v-if="selected.notes" class="fact">
              <span class="fi"><Icon name="info" /></span>
              <div><span class="fl">{{ m.notes }}</span><b class="notes">{{ selected.notes }}</b></div>
            </div>
            <div v-if="selected.sourceUrl" class="fact">
              <span class="fi"><Icon name="external" /></span>
              <div><span class="fl">{{ m.source }}</span><b><ExternalLink class="link" :href="selected.sourceUrl">{{ m.sourceLink }}</ExternalLink></b></div>
            </div>
            <div class="fact">
              <span class="fi"><Icon name="clock" /></span>
              <div><span class="fl">{{ m.updated }}</span><b>{{ updatedOn(selected) }}</b></div>
            </div>
          </div>
        </div>

        <div v-else>
          <h2>{{ m.upcoming }}</h2>
          <div v-if="data && !program" class="cal-empty" data-test="no-program">
            <p>{{ m.noProgram }}</p>
            <RouterLink class="btn sm" :to="{ name: 'onboarding' }">{{ m.finishOnboarding }}</RouterLink>
          </div>
          <div v-else-if="events.length === 0" class="cal-empty" data-test="no-dates">
            <b>{{ m.noDates }}</b>
            <p>{{ m.noDatesText }}</p>
          </div>
          <p v-else-if="upcoming.length === 0" class="cal-empty">{{ m.noUpcoming }}</p>
          <div v-else data-test="upcoming">
            <button
              v-for="e in upcoming"
              :key="e.id"
              type="button"
              class="cal-up-item"
              :class="KIND_GROUP[e.kind]"
              data-test="upcoming-item"
              @click="select(e)"
            >
              <span class="d"><b>{{ dayOfMonth(firstDayShown(e)) }}</b><small>{{ m.monthShort(firstDayShown(e)) }}</small></span>
              <span class="t">
                <b>{{ titleOf(e) }}</b>
                <small><template v-if="ongoing(e)">{{ m.ongoing }} · </template>{{ m.kinds[e.kind] }} · {{ spanOf(e) }}</small>
              </span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style>
.cal-page { max-width: 1440px; }
.cal-page .page-head { align-items: center; }
.cal-wrap { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 24px; align-items: start; }
.cal-main { min-width: 0; display: grid; gap: 14px; }
.cal-bar { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.cal-pick-wrap { position: relative; }
.cal-pick { display: inline-flex; align-items: center; gap: 8px; border: 0; background: none; padding: 4px 8px 4px 0; border-radius: 8px; cursor: pointer; color: var(--ink); }
.cal-pick b { font: 700 24px/1.15 var(--display); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.cal-pick .icon { color: var(--ink-3); transition: transform 0.2s; }
.cal-pick[aria-expanded='true'] .icon { transform: rotate(180deg); }
.cal-pick:hover b { color: var(--info); }
.cal-subt { font-size: 13.5px; color: var(--ink-3); margin-top: 2px; }
.cal-picker {
  position: absolute; z-index: 40; top: calc(100% + 6px); left: 0; width: 280px; max-height: 340px; overflow-y: auto; padding: 6px; display: grid; gap: 2px;
  background: var(--surface); border: 1px solid var(--edge); border-radius: 14px; box-shadow: var(--shadow-lg);
}
.cal-picker button { display: grid; grid-template-columns: 76px 1fr auto; gap: 8px; align-items: center; padding: 8px 10px; border: 0; border-radius: 9px; background: none; text-align: left; cursor: pointer; font: 500 13.5px var(--font); color: var(--ink-2); }
.cal-picker button.wide { grid-template-columns: 1fr 0 auto; }
.cal-picker button:hover { background: var(--surface-2); color: var(--ink); }
.cal-picker button[aria-selected='true'] { background: var(--surface-3); color: var(--ink); }
.cal-picker b { font-weight: 650; color: var(--ink); }
.cal-picker span { font-variant-numeric: tabular-nums; }
.cal-picker em { font-style: normal; font-size: 11.5px; font-weight: 650; padding: 1px 7px; border-radius: 999px; background: var(--info); color: #fff; }
.cal-nav { display: flex; align-items: center; gap: 4px; }
.cal-scroll { position: relative; overflow-x: auto; }

.cal-week { display: grid; grid-template-columns: repeat(7, minmax(88px, 1fr)); gap: 8px; min-width: 660px; }
.cal-dh { display: flex; align-items: center; gap: 8px; padding: 4px 4px 6px; font-size: 13.5px; color: var(--ink-2); }
.cal-dh b { font: 650 19px var(--display); color: var(--ink); width: 34px; height: 34px; display: grid; place-items: center; margin-left: -4px; border-radius: 50%; font-variant-numeric: tabular-nums; }
.cal-dh.today b { background: var(--info); color: #fff; }
.cal-cell { min-height: 280px; border-radius: 12px; background: var(--surface-2); display: grid; align-content: start; gap: 6px; }
.cal-cell.weekend { background: color-mix(in oklab, var(--surface-2) 55%, var(--surface)); }
.cal-cell.today { background: color-mix(in oklab, var(--info) 6%, var(--surface-2)); }
.cal-ev {
  display: grid; gap: 3px; min-width: 0; padding: 10px 12px; border-radius: 12px; text-align: left; cursor: pointer; font: inherit; color: var(--ink);
  background: color-mix(in oklab, var(--c) 14%, var(--surface)); border: 1.5px solid color-mix(in oklab, var(--c) 70%, transparent);
  transition: background 0.15s, box-shadow 0.15s;
}
.cal-ev:hover { background: color-mix(in oklab, var(--c) 22%, var(--surface)); }
.cal-ev.on { box-shadow: 0 0 0 3px color-mix(in oklab, var(--c) 35%, transparent); }
.cal-ev .code { display: flex; align-items: center; gap: 6px; font: 700 11.5px var(--font); color: var(--c-ink); min-width: 0; }
.cal-ev .code i, .cal-ev.cont i { width: 8px; height: 8px; border-radius: 2px; background: var(--c); flex: none; }
.cal-ev .code span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.cal-ev .code em { margin-left: auto; font: 650 10.5px var(--mono); font-style: normal; padding: 1px 6px; border-radius: 5px; background: color-mix(in oklab, var(--c) 22%, var(--surface)); color: var(--c-ink); white-space: nowrap; }
.cal-ev b {
  font-size: 13.5px; font-weight: 650; line-height: 1.3; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden;
}
.cal-ev .room { font: 600 12px var(--mono); color: var(--ink-2); font-variant-numeric: tabular-nums; }
.cal-ev.cont { display: flex; align-items: center; gap: 6px; padding: 5px 10px; border-style: dashed; font-size: 12px; font-weight: 600; color: var(--c-ink); }
.cal-ev.cont span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.cal-ev.exam { border-style: dashed; }

.cal-month { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; min-width: 480px; }
.cal-mh { font-size: 13px; font-weight: 650; color: var(--ink-3); padding: 2px 6px 4px; }
.cal-md { min-height: 108px; border-radius: 12px; background: var(--surface-2); padding: 6px; display: grid; align-content: start; gap: 3px; min-width: 0; }
.cal-md.out { opacity: 0.45; }
.cal-md .n { justify-self: start; width: 28px; height: 28px; border: 0; border-radius: 50%; background: none; font: 650 14px var(--display); color: var(--ink); cursor: pointer; font-variant-numeric: tabular-nums; }
.cal-md .n:hover { background: var(--surface-3); }
.cal-md.today .n { background: var(--info); color: #fff; }
.cal-chip {
  display: flex; align-items: center; gap: 5px; min-width: 0; padding: 2px 6px; border: 0; border-radius: 6px; text-align: left; cursor: pointer; font: 600 11.5px var(--font);
  background: color-mix(in oklab, var(--c, var(--ink-3)) 14%, var(--surface)); color: var(--c-ink, var(--ink-2)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cal-chip.on { box-shadow: 0 0 0 2px color-mix(in oklab, var(--c) 45%, transparent); }
.cal-chip i { width: 6px; height: 6px; border-radius: 2px; background: var(--c, var(--ink-3)); flex: none; }
.cal-md .more { justify-self: start; border: 0; background: none; font-size: 11.5px; color: var(--ink-3); padding: 0 6px; cursor: pointer; }

.cal-up { padding: 18px 16px 10px; }
.cal-up h2 { font-size: 17px; padding: 0 6px 8px; }
.cal-up-item { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 12px; align-items: center; width: 100%; padding: 10px 6px; border: 0; border-top: 1px solid var(--edge); background: none; text-align: left; cursor: pointer; font: inherit; color: inherit; }
.cal-up-item:first-child { border-top: 0; }
.cal-up-item:hover { background: var(--surface-2); }
.cal-up-item .d { display: grid; justify-items: center; line-height: 1; gap: 3px; color: var(--c-ink); }
.cal-up-item .d b { font: 700 21px var(--display); font-variant-numeric: tabular-nums; }
.cal-up-item .d small { font-size: 11.5px; color: var(--ink-3); }
.cal-up-item .t b { display: block; font-size: 14px; font-weight: 650; line-height: 1.3; }
.cal-up-item .t small { font-size: 12.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.cal-empty { display: grid; gap: 8px; justify-items: start; padding: 4px 6px 12px; font-size: 14px; color: var(--ink-2); }
.cal-empty b { color: var(--ink); }

.cal-detail { padding: 2px 4px 8px; display: grid; gap: 16px; }
.cal-detail .hd { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: start; }
.cal-detail .eyebrow { font-size: 12.5px; font-weight: 700; color: var(--c-ink, var(--ink-3)); }
.cal-detail h2 { font-size: 21px; line-height: 1.25; margin-top: 4px; padding: 0; overflow-wrap: anywhere; }
.cal-detail .facts { display: grid; gap: 14px; }
.cal-detail .fact { display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 12px; align-items: start; }
.cal-detail .fi { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; background: var(--surface); border: 1px solid var(--edge); color: var(--ink-2); box-shadow: var(--shadow-sm); }
.cal-detail .fi .icon { width: 18px; height: 18px; }
.cal-detail .fact > div { display: grid; gap: 1px; min-width: 0; padding-top: 1px; }
.cal-detail .fl { font-size: 12.5px; font-weight: 650; color: var(--ink-3); }
.cal-detail .fact b { font-size: 15px; font-weight: 500; color: var(--ink); line-height: 1.35; overflow-wrap: anywhere; }
.cal-detail .fact b.notes { white-space: pre-line; }
.cal-detail .fact small { font-size: 12.5px; color: var(--ink-3); line-height: 1.4; }
.cal-foot { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--ink-3); }
.cal-foot .icon { width: 15px; height: 15px; flex: none; }

@media (max-width: 1180px) {
  .cal-wrap { grid-template-columns: 1fr; }
}
</style>
