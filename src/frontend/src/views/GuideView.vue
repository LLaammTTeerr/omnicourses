<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import ContentLink from '../guides/ContentLink.vue';
import { GUIDE_MESSAGES } from '../guides/messages.js';
import { pickText } from '../guides/pick-text.js';
import { fetchGuide, GuideNotFoundError, type Guide } from '../guides-api.js';
import { formatDate, useLocale, useMessages } from '../locale.js';
import { usePageTitle } from '../page-title.js';

// UC-10 steps 4–6, A5 and A8: one guide, signed in or not. B1 guides have no personal parts.
const props = defineProps<{ id: string; load?: (id: string) => Promise<Guide> }>();
const locale = useLocale();
const m = useMessages(GUIDE_MESSAGES);

const guide = ref<Guide | null>(null);
const notFound = ref(false);
// A failed load shows a plain sentence; the details go to the console.
const failed = ref(false);

async function load(): Promise<void> {
  const id = props.id;
  guide.value = null;
  notFound.value = false;
  failed.value = false;
  try {
    const loaded = await (props.load ?? fetchGuide)(id);
    if (props.id === id) guide.value = loaded;
  } catch (e) {
    if (props.id !== id) return;
    if (e instanceof GuideNotFoundError) notFound.value = true;
    else {
      console.error('Loading the guide failed:', e);
      failed.value = true;
    }
  }
}
watch(() => props.id, load, { immediate: true });

const picked = computed(() => (guide.value ? pickText(guide.value.texts, locale.lang) : null));
const t = computed(() => picked.value?.text ?? null);
// The guide's language on its text when it differs from the screen's (A8).
const textLang = computed(() => (picked.value?.fallback ? picked.value.lang : undefined));
const missing = computed(() => notFound.value || (guide.value !== null && picked.value === null));
const date = (iso: string) => formatDate(iso, locale.lang);
const host = (url: string) => new URL(url).host;

usePageTitle(() => t.value?.title ?? (missing.value ? m.value.notFoundTitle : m.value.guides));
</script>

<template>
  <section class="guide-page" :aria-busy="t === null && !missing && !failed">
    <p class="crumbs">
      <RouterLink :to="{ name: 'guides' }">{{ m.guides }}</RouterLink>
      <template v-if="guide && t"> / {{ m.groups[guide.group] }}</template>
    </p>

    <div v-if="missing" class="card" data-test="not-found">
      <h1>{{ m.notFoundTitle }}</h1>
      <p>{{ m.notFoundText }}</p>
      <RouterLink :to="{ name: 'guides' }">{{ m.allGuides }}</RouterLink>
    </div>
    <p v-else-if="failed" role="alert">
      {{ m.loadFailed }} <button type="button" @click="load">{{ m.retry }}</button>
    </p>
    <p v-else-if="t === null">{{ m.loading }}</p>

    <article v-else class="guide">
      <header class="head">
        <h1 :lang="textLang">{{ t.title }}</h1>
        <p :lang="textLang">{{ t.summary }}</p>
        <p v-if="textLang" class="callout" role="note">{{ m.fallbackNote }}</p>
        <div v-if="t.outOfDate" class="callout warn" role="note" data-test="out-of-date">
          <strong>{{ m.outOfDateTitle }}</strong>
          <p>{{ m.outOfDateText(date(t.lastCheckedOn)) }}</p>
        </div>
      </header>

      <div class="layout">
        <div class="column">
          <section class="card">
            <h2>{{ m.steps }}</h2>
            <ol class="steps" :lang="textLang">
              <li v-for="(step, i) in t.steps" :key="i">
                {{ step.text }}
                <ContentLink v-if="step.link" :link="step.link" />
              </li>
            </ol>
          </section>

          <section v-if="t.portals.length" class="card">
            <h2>{{ m.board }}</h2>
            <ul class="board" :lang="textLang">
              <li v-for="portal in t.portals" :key="portal.url">
                <a :href="portal.url" target="_blank" rel="noopener noreferrer"
                  ><strong>{{ portal.name }}</strong><span class="sr-only">{{ m.newTab }}</span></a
                >
                <span class="host">{{ host(portal.url) }}</span>
                <span>{{ portal.purpose }}</span>
                <span>{{ m.account }} {{ portal.account }}</span>
              </li>
            </ul>
          </section>

          <section v-if="t.notes.length || t.ifPortalDown" class="card">
            <h2>{{ m.notes }}</h2>
            <div v-for="(note, i) in t.notes" :key="i" class="note">
              <p :lang="textLang">{{ note.text }}</p>
              <p class="source">
                {{ m.source }}
                <a v-if="note.source.kind === 'regulation'" :href="note.source.url" target="_blank" rel="noopener noreferrer" :lang="textLang"
                  >{{ note.source.document }}, {{ note.source.clause }}<span class="sr-only">{{ m.newTab }}</span></a
                >
                <template v-else>{{ m.teamExperience }}</template>
              </p>
            </div>
            <div v-if="t.ifPortalDown" class="note">
              <h3>{{ m.ifPortalDown }}</h3>
              <p :lang="textLang">{{ t.ifPortalDown }}</p>
            </div>
          </section>

          <section v-if="t.citations.length" class="card">
            <h2>{{ m.citations }}</h2>
            <ul :lang="textLang">
              <li v-for="(citation, i) in t.citations" :key="i">
                <a :href="citation.url" target="_blank" rel="noopener noreferrer"
                  >{{ citation.document }}, {{ citation.clause }}<span class="sr-only">{{ m.newTab }}</span></a
                >
              </li>
            </ul>
          </section>
        </div>

        <aside class="column">
          <section class="card">
            <h2>{{ m.where }}</h2>
            <p :lang="textLang"><strong>{{ t.portal.name }}</strong></p>
            <p class="host">{{ host(t.portal.url) }}</p>
            <p>{{ m.account }} <span :lang="textLang">{{ t.portal.account }}</span></p>
            <a class="button" :href="t.portal.url" target="_blank" rel="noopener noreferrer" data-test="open-portal"
              >{{ m.openPortal(t.portal.name) }}<span class="sr-only">{{ m.newTab }}</span></a
            >
          </section>

          <section class="card">
            <h2>{{ m.when }}</h2>
            <p :lang="textLang">{{ t.when.text }}</p>
            <p v-if="t.when.announcement"><ContentLink :link="t.when.announcement" /></p>
            <h2>{{ m.appliesTo }}</h2>
            <p :lang="textLang">{{ t.appliesTo }}</p>
            <template v-if="t.prepare.length">
              <h2>{{ m.prepare }}</h2>
              <ul :lang="textLang">
                <li v-for="(item, i) in t.prepare" :key="i">
                  {{ item.text }}
                  <ContentLink v-if="item.link" :link="item.link" />
                </li>
              </ul>
            </template>
            <template v-if="t.related.length">
              <h2>{{ m.related }}</h2>
              <ul :lang="textLang">
                <li v-for="link in t.related" :key="link.url"><ContentLink :link="link" /></li>
              </ul>
            </template>
          </section>

          <section class="meta" data-test="version">
            <p>{{ m.version(t.version, date(t.lastCheckedOn), t.lastCheckedBy) }}</p>
            <p :lang="textLang">{{ m.changeNote(t.changeNote) }}</p>
          </section>
        </aside>
      </div>
    </article>
  </section>
</template>

<style scoped>
.guide-page {
  max-width: 1040px;
  margin: 0 auto;
  display: grid;
  gap: 12px;
}
.crumbs {
  margin: 0;
  font-size: 0.9rem;
}
.head {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
}
h1 {
  margin: 0;
  font-size: 1.75rem;
}
.head p {
  margin: 0;
}
h2 {
  font-size: 1.05rem;
  margin: 0 0 8px;
}
h3 {
  font-size: 0.95rem;
  margin: 0 0 4px;
}
.layout {
  display: grid;
  gap: 16px;
}
@media (min-width: 900px) {
  .layout {
    grid-template-columns: minmax(0, 1fr) 300px;
    align-items: start;
  }
}
.column {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.card {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 12px 16px;
}
.card > p,
.note p {
  margin: 0 0 8px;
}
.steps {
  margin: 0;
  padding-left: 1.5em;
}
.steps li {
  margin: 8px 0;
}
.board {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.board li {
  display: grid;
  gap: 2px;
}
.note + .note {
  border-top: 1px solid #eee;
  padding-top: 8px;
}
.source {
  font-size: 0.85rem;
  color: #555;
}
.host {
  font-family: ui-monospace, monospace;
  font-size: 0.85rem;
  color: #555;
}
.callout {
  margin: 0;
  padding: 10px 12px;
  border-radius: 6px;
  background: #eef1f5;
}
.callout.warn {
  background: #fff4d6;
  color: #4a3000;
  border: 1px solid #e0b84f;
}
.callout.warn p {
  margin: 4px 0 0;
}
.button {
  display: inline-block;
  padding: 8px 14px;
  border-radius: 6px;
  background: #0b4f9c;
  color: #fff;
  text-decoration: none;
  font-weight: 600;
}
.meta {
  font-size: 0.85rem;
  color: #555;
}
.meta p {
  margin: 0 0 4px;
}
a,
p,
li,
h1 {
  overflow-wrap: anywhere;
}
button {
  font: inherit;
  padding: 6px 12px;
  cursor: pointer;
}
</style>
