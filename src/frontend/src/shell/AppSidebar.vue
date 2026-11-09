<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
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
import { isSidebarKey, useSidebar } from './sidebar.js';
import ThemeButton from './ThemeButton.vue';

// The signed-in sidebar (UI prototypes: app shell). Narrows to icons with the button at its foot or the `[` key;
// in the narrow rail each label stays in the accessibility tree and shows as a tooltip.
const auth = useAuth();
const locale = useLocale();
const sidebar = useSidebar();
const m = useMessages(SHELL_MESSAGES);

const main = computed(() => NAV.filter((item) => item.section === 'main'));
const account = computed(() => NAV.filter((item) => item.section === 'account'));
const initials = computed(() =>
  (auth.user?.displayName ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((word) => word[0]!.toUpperCase())
    .join(''),
);
const tip = (text: string) => (sidebar.mini ? text : undefined);

function onKey(event: KeyboardEvent): void {
  if (isSidebarKey(event)) sidebar.toggle();
}
onMounted(() => document.addEventListener('keydown', onKey));
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));
</script>

<template>
  <aside class="side">
    <BrandLink :to="HOME_SIGNED_IN" />
    <nav class="nav" :aria-label="m.nav">
      <RouterLink v-for="item in main" :key="item.route" :class="groupClass(item.group)" :to="{ name: item.route }" :title="tip(item.label[locale.lang])">
        <span class="ico"><Icon :name="item.icon" /></span><span class="tx">{{ item.label[locale.lang] }}</span>
      </RouterLink>
      <span class="nav-label" aria-hidden="true"><span class="tx">{{ m.account }}</span></span>
      <RouterLink v-for="item in account" :key="item.route" :class="groupClass(item.group)" :to="{ name: item.route }" :title="tip(item.label[locale.lang])">
        <span class="ico"><Icon :name="item.icon" /></span><span class="tx">{{ item.label[locale.lang] }}</span>
      </RouterLink>
    </nav>
    <div class="side-foot">
      <ThemeButton class="side-toggle" />
      <LangButton class="side-toggle" />
      <button type="button" class="side-toggle" :aria-pressed="sidebar.mini" :title="tip(m.expand)" @click="sidebar.toggle()">
        <span class="ico"><Icon name="panel" /></span><span class="tx">{{ m.collapse }}</span><kbd class="tx" aria-hidden="true">[</kbd>
      </button>
      <RouterLink v-if="auth.user" class="me" :to="{ name: 'settings' }" :title="tip(auth.user.displayName)">
        <span class="avatar" aria-hidden="true">{{ initials }}</span>
        <span class="tx"><b>{{ auth.user.displayName }}</b><small>{{ auth.user.email }}</small></span>
      </RouterLink>
    </div>
  </aside>
</template>

<style>
.side {
  position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; gap: 6px;
  padding: 20px 16px; background: var(--surface); border-right: 1px solid var(--edge);
  overflow-y: auto; overflow-x: hidden; scrollbar-width: none; transition: padding 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.side .brand { padding: 2px 6px 16px; }
.nav { display: grid; grid-template-columns: minmax(0, 1fr); gap: 3px; }
.nav-label { font-size: 12px; font-weight: 650; color: var(--ink-3); padding: 14px 10px 6px; transition: margin 0.3s, padding 0.3s; }
.nav a, .side-toggle {
  display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 8px; text-decoration: none;
  font-weight: 550; font-size: 14px; color: var(--ink-2); white-space: nowrap; overflow: hidden; position: relative;
}
.side-toggle { border: 0; background: none; cursor: pointer; text-align: left; width: 100%; color: var(--ink-3); }
.nav a:hover, .side-toggle:hover { background: var(--surface-2); color: var(--ink); }
.nav a.router-link-active { background: var(--surface-3); color: var(--ink); font-weight: 650; }
.side .ico { width: 20px; height: 20px; display: grid; place-items: center; color: var(--ink-3); flex: none; }
.nav a.router-link-active .ico { color: var(--c); }
.side .ico .icon { width: 18px; height: 18px; }
.side .tx { white-space: nowrap; overflow: hidden; transition: opacity 0.2s 0.08s; }
.side-toggle kbd { margin-left: auto; font: 600 11px var(--mono); padding: 1px 6px; border-radius: 5px; background: var(--surface-3); color: var(--ink-3); }
.side-toggle[aria-pressed='true'] .ico .icon { transform: scaleX(-1); }
.side-foot { margin-top: auto; display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; padding-top: 16px; }
.me { display: flex; align-items: center; gap: 10px; padding: 10px; margin-top: 6px; border-radius: 14px; background: var(--surface-2); text-decoration: none; overflow: hidden; }
.me .tx { min-width: 0; }
.me b { display: block; font-size: 14px; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; }
.me small { display: block; color: var(--ink-3); font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
.avatar {
  width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; flex: none;
  background: var(--surface-3); color: var(--ink); font-weight: 650; font-size: 13px; text-decoration: none;
}

/* The narrow rail: icons only, labels kept for screen readers. */
.side-mini { --side: 72px; }
.side-mini .side .brand .name, .side-mini .side .tx { opacity: 0; transition-delay: 0s; }
.side-mini .nav-label { height: 0; padding: 6px 0 0; margin: 6px 10px; border-top: 1px solid var(--edge); }
.side-mini .me { background: none; padding: 3px; }
.side-mini .nav a, .side-mini .side-toggle { width: 40px; height: 36px; padding: 0; justify-content: center; justify-self: center; gap: 0; }
.side-mini .nav a .tx, .side-mini .side-toggle .tx { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
