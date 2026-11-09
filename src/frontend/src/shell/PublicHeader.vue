<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { HOME_SIGNED_IN } from '../auth/redirect.js';
import { useAuth } from '../auth/store.js';
import { useLocale, useMessages } from '../locale.js';
import BrandLink from './BrandLink.vue';
import LangButton from './LangButton.vue';
import { SHELL_MESSAGES } from './messages.js';
import { PUBLIC_NAV } from './nav.js';
import ThemeButton from './ThemeButton.vue';

// The header of the pages a visitor can open without an account (UI prototypes: public header).
const auth = useAuth();
const locale = useLocale();
const m = useMessages(SHELL_MESSAGES);
</script>

<template>
  <header class="pub-head">
    <BrandLink :to="{ name: 'home' }" />
    <nav class="pub-nav" :aria-label="m.nav">
      <RouterLink v-for="item in PUBLIC_NAV" :key="item.route" :to="{ name: item.route }">{{ item.label[locale.lang] }}</RouterLink>
    </nav>
    <div class="end">
      <ThemeButton icon-only class="btn sm ghost icon-only" />
      <LangButton short class="btn sm ghost" />
      <RouterLink v-if="auth.signedIn" class="btn sm primary" :to="HOME_SIGNED_IN">{{ m.openApp }}</RouterLink>
      <template v-else>
        <RouterLink class="btn sm ghost sign-in" :to="{ name: 'sign-in' }">{{ m.signIn }}</RouterLink>
        <RouterLink class="btn sm primary" :to="{ name: 'sign-up' }">{{ m.signUp }}</RouterLink>
      </template>
    </div>
  </header>
</template>

<style>
.pub-head {
  position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 8px 14px; flex-wrap: wrap;
  padding: 12px clamp(16px, 4vw, 48px); background: color-mix(in oklab, var(--bg) 85%, transparent);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid var(--edge);
}
.pub-nav { display: flex; gap: 4px; }
.pub-nav a { text-decoration: none; font-weight: 600; font-size: 14.5px; padding: 8px 12px; border-radius: 10px; color: var(--ink-2); }
.pub-nav a:hover, .pub-nav a.router-link-active { background: var(--surface); color: var(--ink); }
.pub-head .end { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.lang-btn, .theme-btn { cursor: pointer; }
.pub-head .ico, .mobile-top .ico { display: grid; place-items: center; }
.pub-head .ico .icon, .mobile-top .ico .icon { width: 16px; height: 16px; }
@media (max-width: 620px) {
  /* A phone keeps the brand, Guides, theme, language and one way in; sign-up is one tap away on sign-in. */
  .pub-head .end .sign-in { display: none; }
  .pub-head .brand .name { font-size: 15px; }
  .pub-nav a { padding: 8px; }
}
@media (max-width: 420px) {
  .pub-head .brand .name { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
}
</style>
