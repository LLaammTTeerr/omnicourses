<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useAsyncLoad } from '../async-load.js';
import ModalDialog from '../components/ModalDialog.vue';
import { fetchCourse, type Course, type CourseStanding, type CurriculumCourse, type TranscriptCourseStatus } from '../curriculum/api.js';
import { courseName } from '../curriculum/present.js';
import { GROUPS, groupClass, type GroupId } from '../groups.js';
import { useLocale, useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { EXPLORER_MESSAGES } from './messages.js';

const props = defineProps<{
  course: CurriculumCourse | null;
  group: { id: GroupId; name: string } | null;
  standing: CourseStanding | null;
  unlocks: readonly CurriculumCourse[];
}>();
const emit = defineEmits<{ close: [] }>();

const locale = useLocale();
const m = useMessages(EXPLORER_MESSAGES);

const detail = useAsyncLoad(
  'the course',
  async () => (props.course ? fetchCourse(props.course!.code) : null),
  () => props.course?.code,
);
const prerequisiteNote = computed(() => {
  const prerequisites = props.course?.prerequisites ?? null;
  const terms = props.course?.offeringTerms ?? null;
  const said = prerequisites === null ? m.value.noPrerequisites : prerequisites.length ? m.value.prerequisitesListed(prerequisites) : m.value.prerequisitesNone;
  return `${said} ${terms === null ? m.value.termsUnknown : m.value.termsListed(terms)}`;
});
const glyph = computed(() => GROUPS.find((g) => g.id === props.group?.id)?.glyph ?? '');
const name = computed(() => (props.course ? courseName(props.course, locale.lang) : ''));
const other = computed(() => (props.course ? (locale.lang === 'en' ? props.course.nameVi : props.course.nameEn) : null));
const nameOf = (item: Course) => courseName(item, locale.lang);
const transcriptChip = (status: TranscriptCourseStatus) => (status === 'passed' ? 'ok' : status === 'in_progress' ? 'info' : 'bad');
const periods = computed(() => {
  const course = props.course;
  if (!course) return [];
  const kinds = m.value.periodKinds;
  const all: [string, number | null][] = [
    [kinds.theory, course.theoryPeriods],
    [kinds.lab, course.labPeriods],
    [kinds.exercise, course.exercisePeriods],
    [kinds.project, course.projectPeriods],
  ];
  return all.filter((entry): entry is [string, number] => entry[1] !== null && entry[1] > 0);
});
</script>

<template>
  <ModalDialog class="drawer" :open="course !== null" labelledby="course-title" @close="emit('close')">
    <template v-if="course">
      <div :class="['drawer-head', group ? groupClass(group.id) : '']">
        <span v-if="group" class="glyph" aria-hidden="true">{{ glyph }}</span>
        <div class="drawer-title">
          <p v-if="group" class="eyebrow">{{ group.name }}</p>
          <h2 id="course-title">{{ name }}</h2>
          <p v-if="other" class="small t3">{{ other }}</p>
        </div>
        <button class="btn sm icon-only" type="button" :aria-label="m.close" @click="emit('close')"><Icon name="x" size="sm" /></button>
      </div>
      <dl class="kv drawer-part">
        <dt>{{ m.code }}</dt>
        <dd><span class="code">{{ course.code }}</span></dd>
        <dt>{{ m.creditsLabel }}</dt>
        <dd class="b">{{ m.credits(course.credits) }}</dd>
        <template v-if="periods.length">
          <dt>{{ m.periods }}</dt>
          <dd>{{ periods.map(([kind, n]) => `${kind} ${n}`).join(' · ') }}</dd>
        </template>
        <template v-if="standing?.transcriptStatus">
          <dt>{{ m.inTranscript }}</dt>
          <dd class="standing-cell" data-test="transcript-note">
            <span :class="['chip', transcriptChip(standing.transcriptStatus)]">{{ m.transcriptStatuses[standing.transcriptStatus] }}</span>
            <span class="small t2">{{ m.transcriptNotes[standing.transcriptStatus] }}</span>
          </dd>
        </template>
        <template v-if="standing?.readiness">
          <dt>{{ m.readiness }}</dt>
          <dd class="standing-cell" data-test="readiness-note">
            <span :class="['chip', standing.readiness === 'available' ? 'ok' : 'warn']">{{ m.readinessStatuses[standing.readiness] }}</span>
            <span v-if="standing.missingPrerequisites.length" class="small t2">{{ m.missingPrerequisites(standing.missingPrerequisites) }}</span>
          </dd>
        </template>
        <template v-if="unlocks.length">
          <dt>{{ m.unlocks }}</dt>
          <dd data-test="unlocks">
            <ul class="memberships">
              <li v-for="item in unlocks" :key="item.code">
                <span class="code">{{ item.code }}</span> {{ nameOf(item) }}
              </li>
            </ul>
          </dd>
        </template>
        <dt>{{ m.memberships }}</dt>
        <dd data-test="memberships">
          <p v-if="detail.status.value === 'loading'" class="t3">…</p>
          <p v-else-if="detail.status.value === 'failed'" class="t3">{{ m.membershipsFailed }}</p>
          <ul v-else class="memberships">
            <li v-for="membership in detail.data.value?.memberships ?? []" :key="`${membership.curriculumCode}-${membership.requirementGroupId}`">
              <span class="code">{{ membership.curriculumCode }}</span> {{ membership.requirementGroupName }}
              <span class="t3">· {{ m.kinds[membership.kind] }}</span>
            </li>
          </ul>
        </dd>
      </dl>
      <p class="small t3 drawer-part" data-test="no-prerequisites"><Icon name="info" size="sm" class="inline" />{{ prerequisiteNote }}</p>
      <div class="drawer-acts drawer-part">
        <RouterLink class="btn sm" :to="{ name: 'plans' }" data-test="open-planner" @click="emit('close')">
          <Icon name="columns" size="sm" />{{ m.openPlanner }}
        </RouterLink>
      </div>
      <p class="xs t3 drawer-part">{{ m.source }}</p>
    </template>
  </ModalDialog>
</template>

<style scoped>
dialog.modal.drawer {
  margin: 0 0 0 auto; width: min(460px, 100vw); height: 100vh; max-height: 100vh; border-radius: 0; border-width: 0 0 0 1px;
  align-content: start; padding: 0 0 24px;
}
.drawer-part { margin: 0 22px; }
.drawer-head { display: flex; align-items: flex-start; gap: 14px; padding: 20px 22px; border-bottom: 1px solid var(--edge); }
.drawer-title { flex: 1; min-width: 0; }
.drawer-title h2 { overflow-wrap: anywhere; }
.drawer .eyebrow { margin-bottom: 4px; }
.kv { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 10px 16px; font-size: 14px; }
.kv dt { color: var(--ink-3); font-weight: 600; }
.kv dd { margin: 0; min-width: 0; }
.standing-cell { display: grid; gap: 4px; justify-items: start; }
.memberships { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.drawer-acts { display: flex; flex-wrap: wrap; gap: 8px; }
:deep(.icon.inline) { display: inline-block; vertical-align: -3px; margin-right: 6px; }
</style>
