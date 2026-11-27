<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { HOME_SIGNED_IN } from '../auth/redirect.js';
import { useAdminAccess } from '../admin/access.js';
import { useAuth } from '../auth/store.js';
import ModalDialog from '../components/ModalDialog.vue';
import { groupClass } from '../groups.js';
import { useLocale, useMessages } from '../locale.js';
import { NOTIFICATION_MESSAGES } from '../notifications/messages.js';
import { useUnread } from '../notifications/store.js';
import UnreadBadge from '../notifications/UnreadBadge.vue';
import BrandLink from './BrandLink.vue';
import Icon from './Icon.vue';
import LangButton from './LangButton.vue';
import { SHELL_MESSAGES } from './messages.js';
import { listed, PHONE_MORE, PHONE_TABS } from './nav.js';
import ThemeButton from './ThemeButton.vue';

defineProps<{ part: 'top' | 'tabs' }>();
const auth = useAuth();
const access = useAdminAccess();
const locale = useLocale();
const route = useRoute();
const m = useMessages(SHELL_MESSAGES);
const notes = useMessages(NOTIFICATION_MESSAGES);
const unread = useUnread();
const initial = computed(() => auth.user?.displayName.trim()[0]?.toUpperCase() ?? '');

const moreOpen = ref(false);
const more = computed(() => listed(PHONE_MORE, access.any));
const inMore = computed(() => more.value.find((item) => route.matched.some((record) => record.name === item.route)) ?? null);
watch(() => route.fullPath, () => (moreOpen.value = false));

let pressedOnBackdrop = false;
function press(event: MouseEvent): void {
  pressedOnBackdrop = event.target === event.currentTarget;
}
function backdrop(event: MouseEvent): void {
  if (pressedOnBackdrop && event.target === event.currentTarget) moreOpen.value = false;
  pressedOnBackdrop = false;
}
</script>

<template>
  <header v-if="part === 'top'" class="mobile-top">
    <BrandLink :to="HOME_SIGNED_IN" />
    <span class="end">
      <ThemeButton icon-only class="btn sm ghost icon-only" />
      <LangButton short class="btn sm ghost" />
      <RouterLink class="btn sm ghost icon-only bell" :to="{ name: 'notifications' }" :aria-label="notes.bell(unread.count)" data-test="bell">
        <Icon name="bell" /><UnreadBadge aria-hidden="true" />
      </RouterLink>
      <RouterLink class="avatar" :to="{ name: 'settings' }" :aria-label="m.account">{{ initial }}</RouterLink>
    </span>
  </header>
  <template v-else>
    <nav class="tabbar" :aria-label="m.tabs" :style="{ '--tabs': PHONE_TABS.length + 1 }">
      <RouterLink v-for="item in PHONE_TABS" :key="item.route" :class="groupClass(item.group)" :to="{ name: item.route }">
        <Icon :name="item.icon" /><span>{{ (item.tab ?? item.label)[locale.lang] }}</span>
      </RouterLink>
      <button
        type="button"
        data-test="more"
        :class="[groupClass(inMore?.group ?? 'core'), { 'router-link-active': inMore }]"
        :aria-current="inMore ? 'page' : undefined"
        aria-haspopup="dialog"
        aria-controls="more-sheet"
        :aria-expanded="moreOpen ? 'true' : 'false'"
        @click="moreOpen = true"
      >
        <Icon name="more" /><span>{{ m.more }}</span>
      </button>
    </nav>
    <ModalDialog id="more-sheet" class="more-sheet" :open="moreOpen" labelledby="more-title" @close="moreOpen = false" @mousedown="press" @click="backdrop">
      <div class="more-body">
        <div class="more-head">
          <h2 id="more-title">{{ m.more }}</h2>
          <button class="btn sm icon-only" type="button" :aria-label="m.close" @click="moreOpen = false"><Icon name="x" size="sm" /></button>
        </div>
        <ul class="more-list">
          <li v-for="item in more" :key="item.route">
            <RouterLink :class="groupClass(item.group)" :to="{ name: item.route }" :data-test="`more-${item.route}`" @click="moreOpen = false">
              <Icon :name="item.icon" /><span>{{ item.label[locale.lang] }}</span><UnreadBadge v-if="item.unreadBadge" />
            </RouterLink>
          </li>
        </ul>
      </div>
    </ModalDialog>
  </template>
</template>

<style scoped>
.mobile-top, .tabbar { display: none; }
@media (max-width: 960px) {
  .mobile-top {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px;
    background: var(--surface); border-bottom: 1px solid var(--edge); position: sticky; top: 0; z-index: 30;
  }
  .mobile-top .end { display: flex; align-items: center; gap: 6px; }
  .mobile-top :deep(.ico) { display: grid; place-items: center; }
  .mobile-top :deep(.ico .icon) { width: 16px; height: 16px; }
  .mobile-top .bell { position: relative; }
  .mobile-top .bell :deep(.badge) { position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px; padding: 0 4px; font-size: 10.5px; }
  .avatar {
    width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; flex: none;
    background: var(--surface-3); color: var(--ink); font-weight: 650; font-size: 13px; text-decoration: none;
  }
  .tabbar {
    display: grid; grid-template-columns: repeat(var(--tabs), minmax(0, 1fr)); position: fixed; left: 10px; right: 10px;
    bottom: calc(10px + env(safe-area-inset-bottom, 0px)); z-index: 50;
    background: var(--surface); border: 1px solid var(--edge); border-radius: 14px; box-shadow: var(--shadow-lg); padding: 6px;
  }
  .tabbar a, .tabbar button {
    display: grid; justify-items: center; gap: 2px; padding: 6px 0; border: 0; border-radius: 10px; background: none; cursor: pointer;
    text-decoration: none; font: inherit; font-size: 11.5px; font-weight: 650; color: var(--ink-3);
  }
  .tabbar a.router-link-active, .tabbar button.router-link-active { background: var(--c); color: var(--on); }
}
dialog.modal.more-sheet { margin: auto 10px calc(10px + env(safe-area-inset-bottom, 0px)); width: auto; max-width: none; padding: 0; border-radius: 16px; }
.more-body { display: grid; gap: 8px; padding: 16px; }
.more-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
dialog.modal.more-sheet h2 { font-size: 18px; }
.more-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.more-list a { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 10px; text-decoration: none; color: var(--ink); font-weight: 600; }
.more-list a :deep(.icon) { color: var(--c); }
.more-list a :deep(.badge) { margin-left: auto; }
.more-list a.router-link-active { background: var(--c); color: var(--on); }
.more-list a.router-link-active :deep(.icon) { color: inherit; }
</style>
