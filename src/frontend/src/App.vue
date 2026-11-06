<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { LANGUAGES, useLocale, useMessages } from './locale.js';

const locale = useLocale();
const m = useMessages({
  vi: { skip: 'Bỏ qua điều hướng', nav: 'Điều hướng chính', guides: 'Hướng dẫn' },
  en: { skip: 'Skip to main content', nav: 'Main navigation', guides: 'Guides' },
});
const other = computed(() => LANGUAGES[locale.lang].other);
</script>

<template>
  <a class="skip" href="#main">{{ m.skip }}</a>
  <header class="bar">
    <RouterLink to="/" class="brand"><strong>OmniCourse</strong></RouterLink>
    <nav :aria-label="m.nav">
      <RouterLink :to="{ name: 'guides' }">{{ m.guides }}</RouterLink>
    </nav>
    <button type="button" class="lang" :lang="other" @click="locale.set(other)">{{ LANGUAGES[other].name }}</button>
  </header>
  <main id="main" tabindex="-1">
    <RouterView v-slot="{ Component, route }">
      <KeepAlive><component :is="Component" v-if="route.meta.keepAlive" /></KeepAlive>
      <component :is="Component" v-if="!route.meta.keepAlive" />
    </RouterView>
  </main>
</template>

<style>
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e5e5;
}
.bar a {
  color: inherit;
}
.bar nav {
  flex: 1;
}
.bar .lang {
  padding: 4px 10px;
}
main {
  padding: 16px;
}
main:focus {
  outline: none;
}
.skip {
  position: absolute;
  left: 8px;
  top: -48px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid var(--accent);
  z-index: 10;
}
.skip:focus {
  top: 8px;
}
</style>
