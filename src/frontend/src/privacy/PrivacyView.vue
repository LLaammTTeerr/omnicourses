<script setup lang="ts">
import { computed } from 'vue';
import { SETTINGS_MESSAGES } from '../account/messages.js';
import { formatDate, useLocale, useMessages } from '../locale.js';
import { usePageTitle } from '../page-title.js';
import { PRIVACY_MESSAGES, PRIVACY_UPDATED_ON } from './messages.js';

// The privacy notice (UC-01 step 2, TC-B1-USER-01p): public, linked beside the consent box on sign-up.
const locale = useLocale();
const m = useMessages(PRIVACY_MESSAGES);
const s = useMessages(SETTINGS_MESSAGES);

const exportPath = computed(() => ({ settings: s.value.title, section: s.value.data, button: s.value.export }));
const deletePath = computed(() => ({ settings: s.value.title, section: s.value.data, button: s.value.delete }));

usePageTitle(() => m.value.title);
</script>

<template>
  <article class="privacy">
    <header>
      <h1>{{ m.title }}</h1>
      <p class="lead">{{ m.lead }}</p>
      <p class="updated">{{ m.updated(formatDate(PRIVACY_UPDATED_ON, locale.lang)) }}</p>
    </header>

    <section aria-labelledby="privacy-stored">
      <h2 id="privacy-stored">{{ m.storedTitle }}</h2>
      <p>{{ m.storedIntro }}</p>
      <ul data-test="stored">
        <li v-for="item in m.stored" :key="item">{{ item }}</li>
      </ul>
      <p>{{ m.noPortalPassword }}</p>
    </section>

    <section aria-labelledby="privacy-kept">
      <h2 id="privacy-kept">{{ m.keptTitle }}</h2>
      <p>{{ m.kept }}</p>
    </section>

    <section aria-labelledby="privacy-control">
      <h2 id="privacy-control">{{ m.controlTitle }}</h2>
      <ul>
        <li data-test="export">{{ m.exportHow(exportPath) }}</li>
        <li data-test="delete">{{ m.deleteHow(deletePath) }} {{ m.deleteGrace }}</li>
      </ul>
    </section>

    <section aria-labelledby="privacy-backups">
      <h2 id="privacy-backups">{{ m.backupsTitle }}</h2>
      <ul>
        <li v-for="item in m.backups" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section aria-labelledby="privacy-ai">
      <h2 id="privacy-ai">{{ m.aiTitle }}</h2>
      <ul>
        <li v-for="item in m.ai" :key="item">{{ item }}</li>
      </ul>
    </section>
  </article>
</template>

<style scoped>
/* One readable column, like a guide's text: short lines, plain sections. */
.privacy {
  max-width: 72ch;
  margin: 0 auto;
  display: grid;
  gap: 22px;
}
header {
  display: grid;
  gap: 8px;
}
h1 {
  margin: 0;
}
h2 {
  font-size: 17px;
  margin: 0 0 8px;
}
p {
  margin: 0 0 8px;
}
.lead {
  color: var(--ink-2);
}
.updated {
  font-size: 13px;
  color: var(--ink-3);
}
ul {
  margin: 0 0 8px;
  padding-left: 1.2em;
  display: grid;
  gap: 6px;
}
h1,
h2,
p,
li {
  overflow-wrap: anywhere;
}
</style>
