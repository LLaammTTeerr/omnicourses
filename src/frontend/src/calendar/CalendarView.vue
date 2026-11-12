<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useAsyncLoad } from '../async-load.js';
import { useAuth } from '../auth/store.js';
import ExternalLink from '../components/ExternalLink.vue';
import { useLocale, useMessages, LANGUAGES } from '../locale.js';
import { usePageTitle } from '../page-title.js';
import Icon from '../shell/Icon.vue';
import { termName, vietnamDate } from '../terms.js';
import { fetchAcademicCalendar, type CalendarEvent, type CalendarEventKind } from './api.js';
import { academicYearMonths, academicYearOf, addDays, eventsByDay, monthDays, monthStart, monthWeeks, mondayOf, sameMonth, termWeek, weekday } from './dates.js';
import { CALENDAR_MESSAGES } from './messages.js';

// F10 school dates (ADR 0016) on the calendar prototype's week and month views. The dates are loaded once per visit;
// moving between weeks and months asks the API nothing. The prototype's own timetable, deadlines and notes need
// per-student data that does not exist yet, so this page shows only what the program administrator entered.
const auth = useAuth();
const locale = useLocale();
const m = useMessages(CALENDAR_MESSAGES);

const { status, data, reload } = useAsyncLoad('the academic calendar', () => auth.authed(fetchAcademicCalendar));
const events = computed(() => data.value?.events ?? []);
const program = computed(() => data.value?.program ?? null);

// ---------- Where the calendar is ----------
const today = vietnamDate(new Date());
// On a weekend the week view opens on the coming week, as in the prototype.
const homeWeek = mondayOf(weekday(today) >= 5 ? addDays(today, 7) : today);
const homeMonth = monthStart(today);
const mode = ref<'week' | 'month'>('week');
const week = ref(homeWeek);
const month = ref(homeMonth);
const selectedId = ref<string | null>(null);

const weekDays = computed(() => Array.from({ length: 7 }, (_, i) => addDays(week.value, i)));
const days = computed(() => (mode.value === 'week' ? weekDays.value : monthDays(month.value)));
const byDay = computed(() => eventsByDay(events.value, days.value[0]!, days.value.at(-1)!));
const on = (day: string) => byDay.value.get(day) ?? [];

/** The term week of the week starting on `monday`, from the first of its days in a term (a term may start mid-week). */
function weekOfTerm(monday: string) {
  for (let i = 0; i < 7; i++) {
    const found = termWeek(addDays(monday, i), events.value);
    if (found) return found;
  }
  return null;
}
const shownTermWeek = computed(() => weekOfTerm(week.value));

const rangeLabel = computed(() => (mode.value === 'week' ? `${m.value.day(week.value)} – ${m.value.day(addDays(week.value, 6))}` : m.value.monthName(month.value)));
const subtitle = computed(() => {
  const found = mode.value === 'week' ? shownTermWeek.value : null;
  if (found) return `${termName(found.term, locale.lang)} · ${m.value.weekNumber(found.week)}`;
  return m.value.academicYear(academicYearOf(mode.value === 'week' ? addDays(week.value, 3) : month.value));
});
const atHome = computed(() => (mode.value === 'week' ? week.value === homeWeek : month.value === homeMonth));

function go(n: number): void {
  if (mode.value === 'week') week.value = addDays(week.value, 7 * n);
  else month.value = monthStart(month.value, n);
}
function goHome(): void {
  week.value = homeWeek;
  month.value = homeMonth;
}
function setMode(next: 'week' | 'month'): void {
  // The month that holds most of the shown week, and back to that month's first week or the current one.
  if (next === 'month' && mode.value === 'week') month.value = monthStart(addDays(week.value, 3));
  if (next === 'week' && mode.value === 'month') week.value = sameMonth(homeWeek, month.value) || sameMonth(addDays(homeWeek, 6), month.value) ? homeWeek : monthWeeks(month.value)[0]!;
  mode.value = next;
}
function openWeek(day: string): void {
  week.value = mondayOf(day);
  mode.value = 'week';
}

// ---------- Week or month picker ----------
const pickerOpen = ref(false);
const pickWrap = ref<HTMLElement | null>(null);
const pickerItems = computed(() =>
  mode.value === 'week'
    ? monthWeeks(monthStart(addDays(week.value, 3))).map((monday) => {
        const found = weekOfTerm(monday);
        return {
          key: monday,
          label: found ? m.value.weekNumber(found.week) : m.value.day(monday),
          range: `${m.value.day(monday)} – ${m.value.day(addDays(monday, 6))}`,
          selected: monday === week.value,
          now: monday === mondayOf(today),
        };
      })
    : academicYearMonths(academicYearOf(month.value)).map((first) => ({
        key: first,
        label: m.value.monthName(first),
        range: '',
        selected: first === month.value,
        now: first === homeMonth,
      })),
);
function pick(key: string): void {
  if (mode.value === 'week') week.value = key;
  else month.value = key;
  pickerOpen.value = false;
}

// ---------- Events ----------
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
const spanOf = (e: CalendarEvent) => (e.startsOn === e.endsOn ? m.value.day(e.startsOn) : `${m.value.day(e.startsOn)} – ${m.value.day(e.endsOn)}`);
const dayCount = (e: CalendarEvent) => Math.round((Date.parse(e.endsOn) - Date.parse(e.startsOn)) / 86_400_000) + 1;
const termOf = (e: CalendarEvent) => (e.term === null ? m.value.wholeYear(e.academicYear) : m.value.term(e.term, e.academicYear));
/** A day of the week view that continues an event started earlier in the same week: a short line, not the whole card. */
const continues = (e: CalendarEvent, day: string) => day !== e.startsOn && day !== week.value;

const upcoming = computed(() => events.value.filter((e) => e.endsOn >= today).slice(0, 8));
const selected = computed(() => events.value.find((e) => e.id === selectedId.value) ?? null);

function select(e: CalendarEvent): void {
  selectedId.value = selectedId.value === e.id ? null : e.id;
  if (!selectedId.value) return;
  // Show the event in the week view when it is not in the week on screen.
  const end = addDays(week.value, 6);
  if (mode.value === 'week' && (e.endsOn < week.value || e.startsOn > end)) week.value = mondayOf(e.startsOn);
}

const updatedOn = (e: CalendarEvent) => new Intl.DateTimeFormat(LANGUAGES[locale.lang].tag, LANGUAGES[locale.lang].date).format(new Date(e.updatedAt));

// ---------- Keys and outside clicks ----------
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
      <div class="seg" role="tablist" :aria-label="m.view">
        <button type="button" role="tab" :aria-selected="mode === 'week'" data-test="tab-week" @click="setMode('week')">{{ m.week }}</button>
        <button type="button" role="tab" :aria-selected="mode === 'month'" data-test="tab-month" @click="setMode('month')">{{ m.month }}</button>
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

        <div class="cal-scroll">
          <div v-if="mode === 'week'" class="cal-week" data-test="week">
            <div v-for="(day, i) in weekDays" :key="day" class="cal-dh" :class="{ today: day === today }">
              <span>{{ m.weekdays[i] }}</span><b>{{ Number(day.slice(8)) }}</b>
            </div>
            <div v-for="day in weekDays" :key="`c${day}`" class="cal-cell" :class="{ today: day === today, weekend: weekday(day) >= 5 }" :data-day="day">
              <button
                v-for="e in on(day)"
                :key="e.id"
                type="button"
                class="cal-ev"
                :class="[KIND_GROUP[e.kind], { exam: e.kind === 'exam_period', cont: continues(e, day), on: e.id === selectedId }]"
                :aria-pressed="e.id === selectedId"
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
            <div v-for="d in m.weekdays" :key="d" class="cal-mh">{{ d }}</div>
            <div v-for="day in days" :key="day" class="cal-md" :class="{ out: !sameMonth(day, month), today: day === today }" :data-day="day">
              <button type="button" class="n" :aria-label="m.longDay(day)" @click="openWeek(day)">{{ Number(day.slice(8)) }}</button>
              <button
                v-for="e in on(day).slice(0, 3)"
                :key="e.id"
                type="button"
                class="cal-chip"
                :class="[KIND_GROUP[e.kind], { on: e.id === selectedId }]"
                :aria-pressed="e.id === selectedId"
                data-test="event"
                @click="select(e)"
              >
                <i></i>{{ titleOf(e) }}
              </button>
              <button v-if="on(day).length > 3" type="button" class="more" @click="openWeek(day)">{{ m.more(on(day).length - 3) }}</button>
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
                <b>{{ selected.startsOn === selected.endsOn ? m.longDay(selected.startsOn) : `${m.longDay(selected.startsOn)} – ${m.longDay(selected.endsOn)}` }}</b>
                <small>{{ m.days(dayCount(selected)) }}<template v-if="selected.endsOn >= today && selected.startsOn <= today"> · {{ m.ongoing }}</template></small>
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
          <div v-if="!program" class="cal-empty" data-test="no-program">
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
              <span class="d"><b>{{ Number((e.startsOn < today ? today : e.startsOn).slice(8)) }}</b><small>{{ m.monthShort(e.startsOn < today ? today : e.startsOn) }}</small></span>
              <span class="t">
                <b>{{ titleOf(e) }}</b>
                <small><template v-if="e.startsOn <= today">{{ m.ongoing }} · </template>{{ m.kinds[e.kind] }} · {{ spanOf(e) }}</small>
              </span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style>
/* The calendar prototype (ui-prototypes/calendar.html), with all-day school dates in place of class periods. */
.cal-page { max-width: 1440px; }
.cal-page .page-head { align-items: center; }
.cal-page .seg button[aria-selected='true'] { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); outline: 1px solid var(--edge); }
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
.cal-scroll { overflow-x: auto; }

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
.cal-ev b { font-size: 13.5px; font-weight: 650; line-height: 1.3; overflow-wrap: anywhere; }
.cal-ev .room { font: 600 12px var(--mono); color: var(--ink-2); font-variant-numeric: tabular-nums; }
.cal-ev.cont { display: flex; align-items: center; gap: 6px; padding: 5px 10px; border-style: dashed; font-size: 12px; font-weight: 600; color: var(--c-ink); }
.cal-ev.cont span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.cal-ev.exam { border-style: dashed; }

.cal-month { display: grid; grid-template-columns: repeat(7, minmax(96px, 1fr)); gap: 6px; min-width: 720px; }
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
