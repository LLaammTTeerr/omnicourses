<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { HOME_SIGNED_IN } from '../auth/redirect.js';
import { useAuth } from '../auth/store.js';
import { groupClass } from '../groups.js';
import { useLocale, useMessages } from '../locale.js';
import BrandLink from './BrandLink.vue';
import Icon from './Icon.vue';
import LangButton from './LangButton.vue';
import { SHELL_MESSAGES } from './messages.js';
import { NAV } from './nav.js';
import ThemeButton from './ThemeButton.vue';

// Below 960 px the sidebar gives way to a top bar and a tab bar at the bottom (UI prototypes). `part` picks which.
defineProps<{ part: 'top' | 'tabs' }>();
const auth = useAuth();
const locale = useLocale();
const m = useMessages(SHELL_MESSAGES);
const initial = computed(() => auth.user?.displayName.trim()[0]?.toUpperCase() ?? '');
</script>

<template>
  <header v-if="part === 'top'" class="mobile-top">
    <BrandLink :to="HOME_SIGNED_IN" />
    <span class="end">
      <ThemeButton icon-only class="btn sm ghost icon-only" />
      <LangButton short class="btn sm ghost" />
      <RouterLink class="avatar" :to="{ name: 'settings' }" :aria-label="m.account">{{ initial }}</RouterLink>
    </span>
  </header>
  <nav v-else class="tabbar" :aria-label="m.tabs" :style="{ '--tabs': NAV.length }">
    <RouterLink v-for="item in NAV" :key="item.route" :class="groupClass(item.group)" :to="{ name: item.route }">
      <Icon :name="item.icon" /><span>{{ item.label[locale.lang] }}</span>
    </RouterLink>
  </nav>
</template>

<style>
.mobile-top, .tabbar { display: none; }
@media (max-width: 960px) {
  .mobile-top {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px;
    background: var(--surface); border-bottom: 1px solid var(--edge); position: sticky; top: 0; z-index: 30;
  }
  .mobile-top .end { display: flex; align-items: center; gap: 6px; }
  .tabbar {
    display: grid; grid-template-columns: repeat(var(--tabs), minmax(0, 1fr)); position: fixed; left: 10px; right: 10px; bottom: 10px; z-index: 50;
    background: var(--surface); border: 1px solid var(--edge); border-radius: 14px; box-shadow: var(--shadow-lg); padding: 6px;
  }
  .tabbar a { display: grid; justify-items: center; gap: 2px; padding: 6px 2px; border-radius: 10px; text-decoration: none; font-size: 11.5px; font-weight: 650; color: var(--ink-3); }
  .tabbar a.router-link-active { background: var(--c); color: var(--on); }
}
</style>
