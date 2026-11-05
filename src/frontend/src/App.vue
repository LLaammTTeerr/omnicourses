<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
import { useLocale, useMessages } from './locale.js';

const locale = useLocale();
const m = useMessages({
  vi: { skip: 'Bỏ qua điều hướng', nav: 'Điều hướng chính', guides: 'Hướng dẫn' },
  en: { skip: 'Skip to main content', nav: 'Main navigation', guides: 'Guides' },
});
// The button names the language it switches to, in that language.
const other = () => (locale.lang === 'vi' ? { lang: 'en' as const, label: 'English' } : { lang: 'vi' as const, label: 'Tiếng Việt' });
</script>

<template>
  <a class="skip" href="#main">{{ m.skip }}</a>
  <header class="bar">
    <RouterLink to="/" class="brand"><strong>OmniCourse</strong></RouterLink>
    <nav :aria-label="m.nav">
      <RouterLink :to="{ name: 'guides' }">{{ m.guides }}</RouterLink>
    </nav>
    <button type="button" class="lang" :lang="other().lang" @click="locale.set(other().lang)">{{ other().label }}</button>
  </header>
  <main id="main" tabindex="-1"><RouterView /></main>
</template>

<style>
:root {
  font-family: system-ui, sans-serif;
  color: #1a1a1a;
  background: #fafafa;
}
body {
  margin: 0;
}
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
  font: inherit;
  padding: 4px 10px;
  cursor: pointer;
}
main {
  padding: 16px;
}
main:focus {
  outline: none;
}
:focus-visible {
  outline: 3px solid #0b4f9c;
  outline-offset: 2px;
}
.skip {
  position: absolute;
  left: 8px;
  top: -48px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #0b4f9c;
  z-index: 10;
}
.skip:focus {
  top: 8px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
</style>
