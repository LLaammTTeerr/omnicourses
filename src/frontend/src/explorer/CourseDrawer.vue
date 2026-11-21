<script setup lang="ts">
import { computed } from 'vue';
import { useAsyncLoad } from '../async-load.js';
import { useAuth } from '../auth/store.js';
import ModalDialog from '../components/ModalDialog.vue';
import { fetchCourse, type Course } from '../curriculum/api.js';
import { groupClass, groupOf, type GroupId } from '../groups.js';
import { localName, otherName, useLocale, useMessages } from '../locale.js';
import { COMMON_MESSAGES } from '../messages.js';
import Icon from '../shell/Icon.vue';
import { EXPLORER_MESSAGES } from './messages.js';

// One course, opened from a tile (UI prototypes: explorer.html, the drawer). What the catalog stores, the groups
// that list it, and a neutral mark when the student's own transcript has it. The drawer does not show prerequisites or
// offering terms yet, though F12 records them (ADR 0011); its note still says they are not recorded.
const props = defineProps<{ course: Course | null; group: { id: GroupId; name: string } | null; inTranscript: boolean }>();
const emit = defineEmits<{ close: [] }>();

const auth = useAuth();
const locale = useLocale();
const m = useMessages(EXPLORER_MESSAGES);
const common = useMessages(COMMON_MESSAGES);

const detail = useAsyncLoad(
  'the course',
  async () => (props.course ? auth.authed((token) => fetchCourse(token, props.course!.code)) : null),
  () => props.course?.code,
);
const glyph = computed(() => (props.group ? groupOf(props.group.id).glyph : ''));
const name = computed(() => (props.course ? localName(props.course, locale.lang) : ''));
const other = computed(() => (props.course ? otherName(props.course, locale.lang) : null));
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
        <button class="btn sm icon-only" type="button" :aria-label="common.close" @click="emit('close')"><Icon name="x" size="sm" /></button>
      </div>
      <dl class="kv">
        <dt>{{ m.code }}</dt>
        <dd><span class="code">{{ course.code }}</span></dd>
        <dt>{{ m.creditsLabel }}</dt>
        <dd class="b">{{ m.credits(course.credits) }}</dd>
        <template v-if="periods.length">
          <dt>{{ m.periods }}</dt>
          <dd>{{ periods.map(([kind, n]) => `${kind} ${n}`).join(' · ') }}</dd>
        </template>
        <template v-if="inTranscript">
          <dt>{{ m.inTranscript }}</dt>
          <dd class="small t2" data-test="transcript-note">{{ m.inTranscriptNote }}</dd>
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
      <p class="small t3" data-test="no-prerequisites"><Icon name="info" size="sm" class="inline" />{{ m.noPrerequisites }}</p>
      <p class="xs t3">{{ m.source }}</p>
    </template>
  </ModalDialog>
</template>

<style>
dialog.modal.drawer {
  margin: 0 0 0 auto; width: min(460px, 100vw); height: 100vh; max-height: 100vh; border-radius: 0; border-width: 0 0 0 1px;
  align-content: start; padding: 0 0 24px;
}
dialog.modal.drawer > :not(.drawer-head) { margin: 0 22px; }
.drawer-head { display: flex; align-items: flex-start; gap: 14px; padding: 20px 22px; border-bottom: 1px solid var(--edge); }
.drawer-title { flex: 1; min-width: 0; }
.drawer-title h2 { overflow-wrap: anywhere; }
.drawer .eyebrow { margin-bottom: 4px; }
.kv { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 10px 16px; font-size: 14px; margin: 0; }
.kv dt { color: var(--ink-3); font-weight: 600; }
.kv dd { margin: 0; min-width: 0; }
.memberships { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.icon.inline { display: inline-block; vertical-align: -3px; margin-right: 6px; }
</style>
