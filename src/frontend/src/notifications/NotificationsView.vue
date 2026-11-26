<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import { useAsyncLoad } from '../async-load.js';
import { groupClass, type GroupId } from '../groups.js';
import { formatDateTime, useLocale, useMessages } from '../locale.js';
import { usePageTitle } from '../page-title.js';
import Icon from '../shell/Icon.vue';
import type { IconName } from '../shell/icons.js';
import { useToast } from '../shell/toast.js';
import { fetchNotifications, markAllRead, markRead, type Notification, type NotificationKind, type NotificationLink } from './api.js';
import { eventLine, NOTIFICATION_MESSAGES } from './messages.js';
import { useUnread } from './store.js';

const PAGE_SIZE = 50;

const LINK_ROUTES: Record<NotificationLink, RouteLocationRaw> = { calendar: { name: 'calendar' }, planner: { name: 'plans' }, audit: { name: 'audit' } };
const KIND_LOOK: Record<NotificationKind, { icon: IconName; group: GroupId }> = {
  registration_soon: { icon: 'calendar', group: 'elec' },
  registration_open: { icon: 'calendar', group: 'elec' },
  term_start: { icon: 'calendar', group: 'core' },
  transcript_changed: { icon: 'file', group: 'gen' },
};

const locale = useLocale();
const m = useMessages(NOTIFICATION_MESSAGES);
const unread = useUnread();
const toast = useToast();
usePageTitle(() => m.value.title);

const { status, data, reload } = useAsyncLoad('the notifications', () => fetchNotifications(PAGE_SIZE));
const items = ref<Notification[]>([]);
const nextBefore = ref<string | null>(null);
const olderStatus = ref<'idle' | 'loading' | 'failed'>('idle');
const busy = ref(false);
const heading = useTemplateRef<HTMLHeadingElement>('heading');
const list = useTemplateRef<HTMLUListElement>('list');

watch(data, (list) => {
  items.value = list?.notifications ?? [];
  nextBefore.value = list?.nextBefore ?? null;
  olderStatus.value = 'idle';
});

const anyUnread = computed(() => items.value.some((item) => item.readAt === null) || unread.count > 0);
const titleId = (item: Notification) => `notification-${item.id}`;
const detail = (item: Notification) => (item.event ? eventLine(item.event, locale.lang) : m.value.transcriptDetail);

function replace(read: Notification): void {
  items.value = items.value.map((item) => (item.id === read.id ? read : item));
}

async function readOne(item: Notification): Promise<void> {
  if (item.readAt !== null) return;
  try {
    replace(await markRead(item.id));
  } catch (e) {
    console.error('Marking a notification read failed:', e);
    toast.show(m.value.markFailed);
  }
  await unread.refresh();
}

async function readWithButton(item: Notification): Promise<void> {
  await readOne(item);
  await nextTick();
  list.value?.querySelector<HTMLElement>(`[aria-labelledby="${titleId(item)}"] a`)?.focus();
}

async function readAll(): Promise<void> {
  busy.value = true;
  try {
    const { unread: left } = await markAllRead();
    const now = new Date().toISOString();
    items.value = items.value.map((item) => (item.readAt === null ? { ...item, readAt: now } : item));
    unread.set(left);
    toast.show(m.value.allRead);
    await nextTick();
    heading.value?.focus();
  } catch (e) {
    console.error('Marking every notification read failed:', e);
    toast.show(m.value.markFailed);
  } finally {
    busy.value = false;
  }
}

async function loadOlder(): Promise<void> {
  olderStatus.value = 'loading';
  try {
    const page = await fetchNotifications(PAGE_SIZE, nextBefore.value);
    items.value = [...items.value, ...page.notifications];
    nextBefore.value = page.nextBefore;
    olderStatus.value = 'idle';
  } catch (e) {
    console.error('Loading older notifications failed:', e);
    olderStatus.value = 'failed';
  }
}
</script>

<template>
  <div class="page inbox-page">
    <header class="page-head">
      <div>
        <h1 ref="heading" tabindex="-1">{{ m.title }}</h1>
        <p v-if="status === 'loaded'" class="t3" data-test="subtitle">{{ m.subtitle(unread.count) }}</p>
      </div>
      <button v-if="status === 'loaded'" class="btn" type="button" :disabled="busy || !anyUnread" data-test="read-all" @click="readAll">
        <Icon name="check" />{{ m.markAllRead }}
      </button>
    </header>

    <p v-if="status === 'failed'" class="callout bad" role="alert">
      <Icon name="alert" /><span>{{ m.loadFailed }} <button class="btn sm" type="button" @click="reload">{{ m.retry }}</button></span>
    </p>
    <p v-else-if="status === 'loading'" class="t3" role="status">{{ m.loading }}</p>

    <section v-else-if="items.length === 0" class="card inbox-empty" data-test="empty">
      <Icon name="check" size="lg" />
      <h2>{{ m.empty }}</h2>
      <p class="t3">{{ m.emptyText }}</p>
    </section>

    <template v-else>
      <ul ref="list" class="card flush inbox-list" :aria-label="m.title">
        <li v-for="item in items" :key="item.id" :class="['note', { unread: item.readAt === null }]" data-test="notification">
          <article :aria-labelledby="titleId(item)">
            <span :class="['glyph', groupClass(KIND_LOOK[item.kind].group)]" aria-hidden="true"><Icon :name="KIND_LOOK[item.kind].icon" /></span>
            <div class="note-body">
              <h2 :id="titleId(item)" class="note-title">
                <span v-if="item.readAt === null" class="sr-only">{{ m.unread }}: </span>{{ m.kinds[item.kind] }}
              </h2>
              <p class="note-detail">{{ detail(item) }}</p>
              <div class="note-actions">
                <RouterLink
                  v-for="(link, i) in item.links"
                  :key="link"
                  :class="['btn', 'sm', { primary: i === 0 }]"
                  :to="LINK_ROUTES[link]"
                  :data-test="`link-${link}`"
                  @click="readOne(item)"
                >
                  {{ m.links[link] }}<Icon name="right" size="sm" />
                </RouterLink>
                <button
                  v-if="item.readAt === null"
                  class="btn sm ghost"
                  type="button"
                  :aria-label="m.markReadOf(m.kinds[item.kind])"
                  data-test="mark-read"
                  @click="readWithButton(item)"
                >
                  <Icon name="check" size="sm" />{{ m.markRead }}
                </button>
              </div>
            </div>
            <time class="note-time" :datetime="item.createdAt">{{ formatDateTime(item.createdAt, locale.lang) }}</time>
          </article>
        </li>
      </ul>
      <p v-if="olderStatus === 'failed'" class="callout bad" role="alert"><Icon name="alert" /><span>{{ m.olderFailed }}</span></p>
      <button v-if="nextBefore" class="btn inbox-older" type="button" :disabled="olderStatus === 'loading'" data-test="older" @click="loadOlder">
        {{ m.older }}
      </button>
    </template>
  </div>
</template>

<style>
.inbox-page { display: grid; gap: 20px; max-width: 860px; }
.inbox-list { list-style: none; margin: 0; overflow: hidden; }
.inbox-list .note + .note { border-top: 1px solid var(--edge); }
.inbox-list article { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 14px; padding: 16px 20px; align-items: start; }
.inbox-list .note.unread { background: color-mix(in oklab, var(--acc) 5%, var(--surface)); }
.inbox-list .note.unread .note-title::before {
  content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--bad); margin-right: 8px; vertical-align: middle;
}
.note-title { font-size: 15px; font-weight: 650; margin: 0; }
.note .note-detail { margin: 4px 0 0; color: var(--ink-2); font-size: 14px; }
.note-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.note-time { font-size: 12.5px; color: var(--ink-3); white-space: nowrap; }
.inbox-empty { display: grid; justify-items: center; gap: 8px; text-align: center; padding: 40px 24px; }
.inbox-empty h2 { font-size: 17px; margin: 0; }
.inbox-older { justify-self: center; }
.inbox-page h1:focus { outline: none; }
@media (max-width: 600px) {
  .inbox-list article { grid-template-columns: auto minmax(0, 1fr); padding: 14px; }
  .note-time { grid-column: 2; grid-row: 1; justify-self: end; }
  .note-body { grid-column: 1 / -1; grid-row: 2; }
}
</style>
