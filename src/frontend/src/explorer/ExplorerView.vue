<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import { statusOf } from '../api.js';
import { newestOnly, useAsyncLoad } from '../async-load.js';
import SelectMenu from '../components/SelectMenu.vue';
import {
  fetchCurriculum,
  fetchCurriculumStanding,
  fetchPrograms,
  type Course,
  type CourseStanding,
  type CurriculumCourse,
  type RequirementGroup,
  type TranscriptCourseStatus,
} from '../curriculum/api.js';
import { courseName as nameIn, groupColour, matches, orderGroups } from '../curriculum/present.js';
import { GROUPS, groupClass, type GroupId } from '../groups.js';
import { useLocale, useMessages } from '../locale.js';
import { programChoices } from '../onboarding/answers.js';
import { useOnboarding } from '../onboarding/store.js';
import { usePageTitle } from '../page-title.js';
import Icon from '../shell/Icon.vue';
import type { IconName } from '../shell/icons.js';
import CourseDrawer from './CourseDrawer.vue';
import { EXPLORER_MESSAGES } from './messages.js';
import { unlockedBy } from './readiness.js';

const onboarding = useOnboarding();
const locale = useLocale();
const m = useMessages(EXPLORER_MESSAGES);

const programs = useAsyncLoad('the programs', () => fetchPrograms());
const choices = computed(() => programChoices(programs.data.value?.programs ?? []).filter((choice) => choice.offered));
const picked = ref<{ program: string; cohort: number } | null>(null);
const selection = computed(() => {
  if (picked.value) return picked.value;
  const answers = onboarding.answers;
  if (answers?.program && answers.cohort) return { program: answers.program, cohort: answers.cohort };
  const first = choices.value[0];
  return first?.cohorts[0] ? { program: first.code, cohort: first.cohorts[0] } : null;
});
const cohorts = computed(() => choices.value.find((choice) => choice.code === selection.value?.program)?.cohorts ?? []);
const programName = (choice: (typeof choices.value)[number]) => (locale.lang === 'en' ? choice.program?.nameEn : null) ?? choice.program?.nameVi ?? choice.code;

let shownCourse: string | null = null;

function pickProgram(code: string): void {
  const cohort = choices.value.find((choice) => choice.code === code)?.cohorts[0];
  if (cohort !== undefined) {
    shownCourse = null;
    open.value = null;
    picked.value = { program: code, cohort };
  }
}
function pickCohort(cohort: number): void {
  if (selection.value) {
    shownCourse = null;
    open.value = null;
    picked.value = { program: selection.value.program, cohort };
  }
}

const curriculum = useAsyncLoad(
  'the curriculum',
  async () => (selection.value ? fetchCurriculum(selection.value!.program, selection.value!.cohort) : null),
  () => (selection.value ? `${selection.value.program}-${selection.value.cohort}` : null),
);

const standings = shallowRef<ReadonlyMap<string, CourseStanding> | null>(null);
const latestStanding = newestOnly();
watch(
  () => (selection.value ? `${selection.value.program}-${selection.value.cohort}` : null),
  async () => {
    const chosen = selection.value;
    standings.value = null;
    if (!chosen) {
      latestStanding.drop();
      return;
    }
    const isNewest = latestStanding.start();
    try {
      const { courses } = await fetchCurriculumStanding(chosen.program, chosen.cohort);
      if (!isNewest()) return;
      standings.value = new Map(courses.map((item) => [item.code, item]));
    } catch (e) {
      if (!isNewest()) return;
      if (statusOf(e) !== 401) console.error('Loading the curriculum standing for the explorer failed:', e);
    }
  },
  { immediate: true },
);

const standingOf = (course: CurriculumCourse): CourseStanding | null => standings.value?.get(course.code) ?? null;
const transcriptIcon = (status: TranscriptCourseStatus): IconName => (status === 'passed' ? 'check' : status === 'in_progress' ? 'clock' : 'alert');

const query = ref('');
const only = ref<GroupId | null>(null);
const groups = computed(() => orderGroups(curriculum.data.value?.requirementGroups ?? []).map((group) => ({ group, colour: groupColour(group) })));
const orderedGroups = computed(() => groups.value.map(({ group }) => group));
const colours = computed(() => GROUPS.filter((g) => groups.value.some((entry) => entry.colour === g.id)));
const courseName = (course: Course) => nameIn(course, locale.lang);
const shown = computed(() =>
  groups.value
    .filter(({ colour }) => !only.value || colour === only.value)
    .map((entry) => ({ ...entry, courses: entry.group.courses.filter((course) => matches(query.value, course.code, course.nameVi, course.nameEn)) }))
    .filter((entry) => entry.courses.length > 0),
);
const courseCount = computed(() => new Set(groups.value.flatMap(({ group }) => group.courses.map((course) => course.code))).size);
const glyph = (id: GroupId) => GROUPS.find((g) => g.id === id)!.glyph;

const open = shallowRef<{ course: CurriculumCourse; group: { id: GroupId; name: string } } | null>(null);
function openCourse(course: CurriculumCourse, group: RequirementGroup, colour: GroupId): void {
  open.value = { course, group: { id: colour, name: group.name } };
}
const openUnlocks = computed(() => (open.value ? unlockedBy(orderedGroups.value, open.value.course.code) : []));

const route = useRoute();
watch(
  () => route.query.course,
  (code, prev) => {
    if (code === prev) return;
    shownCourse = null;
    if (typeof code === 'string') {
      query.value = '';
      only.value = null;
    }
  },
);
watch(
  () => [route.query.course, curriculum.status.value] as const,
  async ([code, status]) => {
    if (typeof code !== 'string' || code === shownCourse || status !== 'loaded') return;
    if (!groups.value.some(({ group }) => group.courses.some((course) => course.code === code))) return;
    shownCourse = code;
    await nextTick();
    const el = document.querySelector<HTMLElement>(`[data-test="course-${CSS.escape(code)}"]`);
    if (!el) return;
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView?.({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
    el.focus({ preventScroll: true });
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    el.addEventListener('animationend', () => el.classList.remove('flash'), { once: true });
  },
  { immediate: true },
);

usePageTitle(() => m.value.title);
</script>

<template>
  <div class="page explorer-page">
    <header class="page-head">
      <div>
        <h1>{{ m.title }}</h1>
        <p v-if="curriculum.data.value" data-test="summary">
          {{ (locale.lang === 'en' && curriculum.data.value.nameEn) || curriculum.data.value.nameVi }} ·
          {{ m.summary(courseCount, curriculum.data.value.totalCreditsMin) }}
        </p>
      </div>
      <div class="head-actions">
        <div class="field">
          <span class="label">{{ m.program }}</span>
          <SelectMenu
            :model-value="selection?.program"
            :aria-label="m.program"
            :options="choices.map((choice) => ({ value: choice.code, label: programName(choice) }))"
            @update:model-value="pickProgram"
          />
        </div>
        <div class="field">
          <span class="label">{{ m.cohort }}</span>
          <SelectMenu
            :model-value="selection?.cohort"
            :aria-label="m.cohort"
            :options="cohorts.map((year) => ({ value: year, label: m.cohortOption(year) }))"
            @update:model-value="pickCohort"
          />
        </div>
      </div>
    </header>

    <div class="ex-tools">
      <label class="search">
        <span class="sr-only">{{ m.search }}</span>
        <Icon name="search" size="sm" />
        <input v-model="query" class="input" type="search" :placeholder="m.searchPlaceholder" />
      </label>
      <div class="chips" role="group" :aria-label="m.filter">
        <button class="chip" type="button" :aria-pressed="only === null" @click="only = null">{{ m.all }}</button>
        <button
          v-for="g in colours"
          :key="g.id"
          :class="['chip', 'soft', groupClass(g.id)]"
          type="button"
          :aria-pressed="only === g.id"
          @click="only = only === g.id ? null : g.id"
        >
          <span aria-hidden="true">{{ g.glyph }}</span> {{ g.short[locale.lang] }}
        </button>
      </div>
    </div>

    <p v-if="curriculum.status.value === 'loading'" class="t3">{{ m.loading }}</p>
    <div v-else-if="curriculum.status.value === 'failed'" class="callout bad" role="alert">
      <Icon name="alert" />
      <div>
        <p>{{ statusOf(curriculum.error.value) === 404 ? m.noCurriculum : m.loadFailed }}</p>
        <button class="btn sm" type="button" @click="curriculum.reload">{{ m.retry }}</button>
      </div>
    </div>
    <template v-else>
      <section
        v-for="{ group, colour, courses } in shown"
        :key="group.id"
        :class="['ex-group', groupClass(colour)]"
        :aria-labelledby="`group-${group.id}`"
        data-test="group"
      >
        <div class="ex-group-head">
          <span class="glyph" aria-hidden="true">{{ glyph(colour) }}</span>
          <div>
            <h2 :id="`group-${group.id}`">{{ group.name }}</h2>
            <p class="small t3">{{ m.rule(group.kind, group.creditsTotal, group.creditsTotalMin) }} · {{ m.courses(group.courses.length) }}</p>
            <p v-if="group.officialNotes" class="small t2 notes">{{ group.officialNotes }}</p>
          </div>
        </div>
        <ul class="ex-grid">
          <li v-for="course in courses" :key="course.code">
            <button class="tile" type="button" :data-test="`course-${course.code}`" @click="openCourse(course, group, colour)">
              <span class="top">
                <span class="k">{{ course.code }}</span>
                <span class="cr">{{ m.credits(course.credits) }}</span>
              </span>
              <span class="nm">{{ courseName(course) }}</span>
              <span v-if="standingOf(course)?.transcriptStatus || standingOf(course)?.readiness" class="marks">
                <span
                  v-if="standingOf(course)?.transcriptStatus"
                  :class="['mark', `is-${standingOf(course)!.transcriptStatus}`]"
                  data-test="transcript-status"
                  :data-status="standingOf(course)!.transcriptStatus!"
                >
                  <Icon :name="transcriptIcon(standingOf(course)!.transcriptStatus!)" size="sm" />{{ m.transcriptStatuses[standingOf(course)!.transcriptStatus!] }}
                </span>
                <span
                  v-if="standingOf(course)?.readiness"
                  :class="['mark', `is-${standingOf(course)!.readiness}`]"
                  data-test="course-readiness"
                  :data-readiness="standingOf(course)!.readiness!"
                >
                  <Icon :name="standingOf(course)!.readiness === 'available' ? 'unlock' : 'lock'" size="sm" />{{ m.readinessStatuses[standingOf(course)!.readiness!] }}
                </span>
              </span>
            </button>
          </li>
        </ul>
      </section>
      <div v-if="shown.length === 0" class="card empty" role="status">
        <b>{{ m.noMatch }}</b>
        <p class="small t2">{{ m.noMatchHint }}</p>
      </div>
    </template>

    <CourseDrawer
      :course="open?.course ?? null"
      :group="open?.group ?? null"
      :standing="open ? standingOf(open.course) : null"
      :unlocks="openUnlocks"
      @close="open = null"
    />
  </div>
</template>

<style scoped>
.explorer-page { display: grid; gap: 22px; grid-template-columns: minmax(0, 1fr); }
.explorer-page .head-actions .field { min-width: 160px; }
.ex-tools { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; justify-content: space-between; }
.ex-tools .search { position: relative; flex: 1 1 260px; max-width: 380px; display: block; }
.ex-tools .search :deep(.icon) { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--ink-3); }
.ex-tools .search .input { padding-left: 36px; width: 100%; }
.ex-tools .chips { display: flex; flex-wrap: wrap; gap: 6px; }
.ex-tools .chip { cursor: pointer; }
.ex-tools .chip[aria-pressed='true'] { border-color: currentColor; }
.ex-tools .chip:not(.soft)[aria-pressed='true'] { background: var(--ink); color: var(--surface); }
.ex-group { display: grid; gap: 12px; }
.ex-group-head { display: flex; align-items: flex-start; gap: 12px; }
.ex-group-head > div { min-width: 0; }
.ex-group-head h2 { font-size: 19px; }
.ex-group-head .notes { margin-top: 4px; max-width: 70ch; }
.ex-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.tile {
  position: relative; width: 100%; height: 100%; min-height: 84px; text-align: left; display: grid; gap: 6px; align-content: start;
  padding: 12px 14px 12px 18px; border-radius: 12px; border: 1px solid var(--edge); background: var(--surface); color: var(--ink);
  font: inherit; cursor: pointer; box-shadow: var(--shadow-sm);
}
.tile::before { content: ''; position: absolute; left: 6px; top: 10px; bottom: 10px; width: 4px; border-radius: 4px; background: var(--c); }
.tile:hover { border-color: var(--c); }
.tile .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.tile .k { font: 700 12px var(--mono); color: var(--c-ink); }
.tile .cr { font-size: 11.5px; font-weight: 650; padding: 1px 7px; border-radius: 999px; background: var(--c); color: var(--on); white-space: nowrap; }
.tile .nm { font-weight: 650; font-size: 13.5px; line-height: 1.3; overflow-wrap: anywhere; }
.tile .marks { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
.tile .mark { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--ink-2); }
.tile .mark.is-passed, .tile .mark.is-available { color: color-mix(in oklab, var(--ok) 75%, var(--ink)); }
.tile .mark.is-in_progress { color: color-mix(in oklab, var(--info) 78%, var(--ink)); }
.tile .mark.is-failed { color: color-mix(in oklab, var(--bad) 80%, var(--ink)); }
.tile .mark.is-locked { color: color-mix(in oklab, var(--warn) 72%, var(--ink)); }
.tile .mark :deep(.icon) { width: 14px; height: 14px; }
.explorer-page .empty { text-align: center; display: grid; gap: 4px; }
@media (max-width: 620px) {
  .explorer-page .head-actions { width: 100%; }
  .explorer-page .head-actions .field { flex: 1 1 140px; min-width: 0; }
  .ex-tools .search { max-width: none; }
  .ex-grid { grid-template-columns: 1fr; }
}
</style>
