<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { newestOnly } from '../async-load.js';
import { EVENT_KIND_GROUP, eventTitle, otherEventTitle, spanIn } from '../calendar/present.js';
import ExternalLink from '../components/ExternalLink.vue';
import SelectMenu from '../components/SelectMenu.vue';
import { formatDate, useLocale, useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { useToast } from '../shell/toast.js';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchProgramCalendar,
  updateCalendarEvent,
  type AcademicCalendar,
  type CalendarEvent,
} from './api.js';
import CalendarEventDialog from './CalendarEventDialog.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import { readFailure } from './errors.js';
import {
  CALENDAR_EVENT_FIELDS,
  calendarEventChanges,
  calendarEventMatches,
  newCalendarEventBody,
  type CalendarEventValues,
} from './forms.js';
import { ADMIN_MESSAGES } from './messages.js';
import { describeProblem } from './problem.js';
import { useAdminAccess } from './access.js';
import { useProgramPicker } from './store.js';
import { useAdminDialog, type WriteOutcome } from './write.js';

const access = useAdminAccess();
const locale = useLocale();
const toast = useToast();
const m = useMessages(ADMIN_MESSAGES);
const text = computed(() => m.value.calendar);

const { programList, programsStatus, loadPrograms, picked, program } = useProgramPicker('the programs to administer');
void loadPrograms();

interface Scope {
  programId: string;
  programCode: string;
}
const scope = computed<Scope | null>(() => (program.value ? { programId: program.value.id, programCode: program.value.code } : null));
const onScreen = (of: Scope): boolean => scope.value?.programId === of.programId;

const grantedIds = computed(() => (access.grants?.programs ?? []).map((grant) => grant.programId).sort().join());
const listedIds = computed(() => (programList.value ?? []).map((item) => item.id).sort().join());
watch([grantedIds, () => access.refusal], () => {
  if (!access.refusal && access.grants && programsStatus.value === 'loaded' && grantedIds.value !== listedIds.value) void loadPrograms(true);
});

const calendar = shallowRef<AcademicCalendar | null>(null);
const status = ref<'loading' | 'loaded' | 'failed'>('loading');
const stale = ref(false);
const newest = newestOnly();

async function readSaved(of: Scope): Promise<AcademicCalendar> {
  const isNewest = onScreen(of) ? newest.start() : null;
  const fresh = await fetchProgramCalendar(of.programCode);
  if (isNewest?.() && onScreen(of)) {
    calendar.value = fresh;
    status.value = 'loaded';
    stale.value = false;
  }
  return fresh;
}

async function load(): Promise<void> {
  calendar.value = null;
  stale.value = false;
  status.value = 'loading';
  const of = scope.value;
  if (!of) return;
  const isNewest = newest.upcoming();
  try {
    await readSaved(of);
  } catch (e) {
    if (!isNewest()) return;
    if (readFailure(e).kind === 'signed_out') return;
    console.error('Loading the academic calendar to administer failed:', e);
    status.value = 'failed';
  }
}

async function showSaved(): Promise<void> {
  const of = scope.value;
  if (!of) return;
  try {
    await readSaved(of);
  } catch (e) {
    if (readFailure(e).kind === 'signed_out') return;
    console.error('Reloading the academic calendar failed:', e);
    stale.value = true;
  }
}

const events = computed(() => calendar.value?.events ?? []);
const titleIn = (event: CalendarEvent) => eventTitle(event, locale.lang);
const otherTitle = (event: CalendarEvent) => otherEventTitle(event, locale.lang);
const datesOf = (event: CalendarEvent) => spanIn(event, (iso) => formatDate(iso, locale.lang));

type Ask = { type: 'event'; event: CalendarEvent | null } | { type: 'delete-event'; event: CalendarEvent };
const notice = ref(false);
const asking = useAdminDialog<Ask & { at: Scope }>({
  fallback: 'add-event',
  notice,
  stale: { reloadId: 'calendar-reload', is: () => stale.value, mark: () => (stale.value = true) },
});
const { dialog, writes: dialogWrites, busy, cancel, close } = asking;

function open(next: Ask, from: Event): void {
  const at = scope.value;
  if (!at || stale.value) return;
  notice.value = false;
  asking.open({ ...next, at }, from);
}

const finish = (result: WriteOutcome<unknown>, saved: string): Promise<boolean> =>
  asking.finish(result, saved, { before: () => (result.outcome === 'saved' ? showSaved() : undefined) });

async function recheckDialog(): Promise<void> {
  if ((await dialogWrites.recheck())?.outcome !== 'confirmed') return;
  await close();
  notice.value = true;
}

async function saveEvent(entered: CalendarEventValues): Promise<void> {
  const current = dialog.value;
  if (current?.type !== 'event') return;
  const { at } = current;
  const title = entered.title.trim();
  if (current.event) {
    const { id } = current.event;
    const body = calendarEventChanges(current.event, entered);
    if (Object.keys(body).length === 0) {
      await close();
      toast.show(text.value.noChange);
      return;
    }
    const result = await dialogWrites.send(
      () => updateCalendarEvent(at.programId, id, body),
      async () => {
        const found = (await readSaved(at)).events.find((item) => item.id === id);
        return found !== undefined && calendarEventMatches(found, entered);
      },
    );
    await finish(result, text.value.saved(title));
    return;
  }
  const before = new Set(onScreen(at) ? events.value.map((item) => item.id) : []);
  const result = await dialogWrites.send(
    () => createCalendarEvent(at.programId, newCalendarEventBody(entered)),
    async () => (await readSaved(at)).events.some((item) => !before.has(item.id) && calendarEventMatches(item, entered)),
  );
  await finish(result, text.value.created(title));
}

async function removeEvent(): Promise<void> {
  const current = dialog.value;
  if (current?.type !== 'delete-event') return;
  const { at, event } = current;
  const label = titleIn(event);
  const result = await dialogWrites.send(
    () => deleteCalendarEvent(at.programId, event.id),
    async () => !(await readSaved(at)).events.some((item) => item.id === event.id),
  );
  await finish(result, text.value.deleted(label));
}

const eventProblem = computed(() =>
  dialog.value?.type === 'event' && dialogWrites.problem.value ? describeProblem(dialogWrites.problem.value, m.value, CALENDAR_EVENT_FIELDS) : null,
);
const confirmProblem = computed(() =>
  dialog.value?.type === 'delete-event' && dialogWrites.problem.value ? describeProblem(dialogWrites.problem.value, m.value) : null,
);

function pickProgram(programId: string): void {
  picked.value = { programId, curriculumId: null };
}
watch(
  () => program.value?.id,
  () => {
    notice.value = false;
    void load();
  },
  { immediate: true },
);
</script>

<template>
  <section class="admin-section" aria-labelledby="calendar-admin-title">
    <h2 id="calendar-admin-title" class="sr-only">{{ text.heading }}</h2>

    <p v-if="programsStatus === 'loading'" class="t3" role="status">{{ m.loading }}</p>
    <p v-else-if="programsStatus === 'failed'" class="callout bad" role="alert" data-test="programs-failed">
      <Icon name="alert" /><span>{{ text.programsFailed }} <button class="btn sm" type="button" @click="loadPrograms()">{{ m.retry }}</button></span>
    </p>
    <p v-else-if="!program" class="callout" role="status" data-test="no-programs"><Icon name="info" /><span>{{ text.noPrograms }}</span></p>
    <template v-else>
      <div class="admin-banner">
        <div class="field">
          <span class="label">{{ text.program }}</span>
          <SelectMenu
            :model-value="program.id"
            :aria-label="text.program"
            :options="(programList ?? []).map((item) => ({ value: item.id, label: `${item.code} · ${item.nameVi}` }))"
            data-test="admin-program"
            @update:model-value="pickProgram"
          />
        </div>
        <p class="grow small t2">{{ text.lead }}</p>
      </div>

      <p v-if="status === 'loading'" class="t3" role="status">{{ m.loading }}</p>
      <p v-else-if="status === 'failed'" class="callout bad" role="alert" data-test="calendar-failed">
        <Icon name="alert" /><span>{{ text.loadFailed }} <button class="btn sm" type="button" @click="load">{{ m.retry }}</button></span>
      </p>
      <template v-else-if="calendar">
        <p v-if="notice" class="callout ok" role="status" data-test="admin-notice"><Icon name="check" /><span>{{ m.problem.confirmed }}</span></p>
        <p v-if="stale" class="callout warn" role="alert" data-test="calendar-stale">
          <Icon name="alert" /><span>{{ m.stale }} <button id="calendar-reload" class="btn sm" type="button" data-test="calendar-reload" @click="showSaved">{{ m.reload }}</button></span>
        </p>

        <section class="card flush" aria-labelledby="calendar-events-title">
          <div class="card-head">
            <h3 id="calendar-events-title" data-test="events-title">{{ text.eventsTitle(events.length) }}</h3>
            <div class="head-acts">
              <button id="add-event" class="btn sm" type="button" :disabled="stale" data-test="add-event" @click="open({ type: 'event', event: null }, $event)">
                <Icon name="plus" size="sm" />{{ text.addEvent }}
              </button>
            </div>
          </div>

          <p v-if="events.length === 0" class="admin-empty t2" data-test="no-events">{{ text.noEvents }}</p>
          <div v-else class="table-wrap">
            <table class="table admin-cards admin-events">
              <thead>
                <tr>
                  <th scope="col">{{ text.columns.title }}</th>
                  <th scope="col">{{ text.columns.kind }}</th>
                  <th scope="col">{{ text.columns.term }}</th>
                  <th scope="col">{{ text.columns.dates }}</th>
                  <th scope="col"><span class="sr-only">{{ text.columns.actions }}</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="event in events" :key="event.id" data-test="event-row" :data-event-id="event.id" :data-kind="event.kind">
                  <th scope="row">
                    <span class="event-title">{{ titleIn(event) }}</span>
                    <span v-if="otherTitle(event)" class="small t3 sub">{{ otherTitle(event) }}</span>
                    <p v-if="event.notes" class="small t2 notes" data-test="event-notes">{{ event.notes }}</p>
                    <ExternalLink v-if="event.sourceUrl" class="link small source" :href="event.sourceUrl" data-test="event-source">{{ text.sourceLink }}</ExternalLink>
                  </th>
                  <td data-test="event-kind" :data-kind="event.kind" :data-label="text.columns.kind">
                    <span :class="['chip', 'soft', EVENT_KIND_GROUP[event.kind]]">{{ text.kinds[event.kind] }}</span>
                  </td>
                  <td data-test="event-term" :data-label="text.columns.term">
                    {{ event.term === null ? text.wholeYear(event.academicYear) : text.term(event.term, event.academicYear) }}
                  </td>
                  <td class="dates" data-test="event-dates" :data-starts-on="event.startsOn" :data-ends-on="event.endsOn" :data-label="text.columns.dates">
                    {{ datesOf(event) }}
                  </td>
                  <td class="r acts">
                    <div class="row-acts">
                      <button
                        class="btn sm"
                        type="button"
                        :disabled="stale"
                        :aria-label="text.editLabel(titleIn(event))"
                        data-test="event-edit"
                        @click="open({ type: 'event', event }, $event)"
                      >
                        <Icon name="edit" size="sm" />{{ text.edit }}
                      </button>
                      <button
                        class="btn sm"
                        type="button"
                        :disabled="stale"
                        :aria-label="text.deleteLabel(titleIn(event))"
                        data-test="event-delete"
                        @click="open({ type: 'delete-event', event }, $event)"
                      >
                        <Icon name="trash" size="sm" />{{ text.delete }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </template>

    <CalendarEventDialog
      :open="dialog?.type === 'event'"
      :event="dialog?.type === 'event' ? dialog.event : null"
      :busy="busy"
      :problem="eventProblem"
      @close="cancel"
      @save="saveEvent"
      @reload="recheckDialog"
    />
    <ConfirmDialog
      :open="dialog?.type === 'delete-event'"
      :title="text.deleteTitle"
      :body="dialog?.type === 'delete-event' ? text.deleteBody(titleIn(dialog.event), dialog.at.programCode) : ''"
      :confirm="text.delete"
      :busy="busy"
      :problem="confirmProblem"
      @close="cancel"
      @confirm="removeEvent"
      @reload="recheckDialog"
    />
  </section>
</template>

<style scoped>
.admin-banner { display: flex; align-items: center; gap: 14px; padding: 14px 18px; background: color-mix(in oklab, var(--hi) 55%, var(--surface)); border-radius: 16px; border: 1px solid var(--edge); flex-wrap: wrap; }
.admin-banner .field { min-width: 180px; }
.admin-banner .grow { flex: 1; min-width: 200px; }
:root[data-theme='dark'] .admin-banner { border-color: color-mix(in oklab, var(--info) 30%, var(--edge)); }
.admin-section .card-head .head-acts { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
.admin-empty { padding: 24px 22px; }
.admin-events .event-title { display: block; overflow-wrap: anywhere; }
.admin-events .sub { display: block; font-weight: 400; margin-top: 2px; overflow-wrap: anywhere; }
.admin-events .notes { font-weight: 400; white-space: pre-line; margin-top: 4px; max-width: 60ch; overflow-wrap: anywhere; }
.admin-events .source { display: inline-block; margin-top: 4px; }
.admin-events .dates { font-variant-numeric: tabular-nums; white-space: nowrap; }
@media (max-width: 760px) {
  .admin-events .dates { white-space: normal; }
}
</style>
