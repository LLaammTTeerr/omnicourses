<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useAsyncLoad } from '../async-load.js';
import ExternalLink from '../components/ExternalLink.vue';
import { formatDate, useLocale, useMessages } from '../locale.js';
import { usePageTitle } from '../page-title.js';
import ContentLink from './ContentLink.vue';
import { fetchGuide } from './api.js';
import LoadFailed from './LoadFailed.vue';
import { GUIDE_MESSAGES } from './messages.js';
import { pickText } from './pick-text.js';

// UC-10 steps 4–6, A5 and A8: one guide, signed in or not. B1 guides have no personal parts.
const props = defineProps<{ id: string }>();
const locale = useLocale();
const m = useMessages(GUIDE_MESSAGES);

const { status, data: guide, reload } = useAsyncLoad('the guide', () => fetchGuide(props.id), () => props.id);

const picked = computed(() => (guide.value ? pickText(guide.value.texts, locale.lang) : null));
const t = computed(() => picked.value?.text ?? null);
// The guide's language on its text when it differs from the screen's (A8).
const textLang = computed(() => (picked.value?.fallback ? picked.value.lang : undefined));
const missing = computed(() => status.value === 'loaded' && picked.value === null);
const date = (iso: string) => formatDate(iso, locale.lang);
const host = (url: string) => new URL(url).host;

usePageTitle(() => t.value?.title ?? (missing.value ? m.value.notFoundTitle : m.value.guides));
</script>

<template>
  <section class="guide-page" :aria-busy="status === 'loading'">
    <p class="crumbs">
      <RouterLink :to="{ name: 'guides' }">{{ m.guides }}</RouterLink>
      <template v-if="guide && t"> / {{ m.groups[guide.group] }}</template>
    </p>

    <div v-if="missing" class="card" data-test="not-found">
      <h1>{{ m.notFoundTitle }}</h1>
      <p>{{ m.notFoundText }}</p>
      <RouterLink :to="{ name: 'guides' }">{{ m.allGuides }}</RouterLink>
    </div>
    <LoadFailed v-else-if="status === 'failed'" @retry="reload" />
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
            <ol class="steps" :lang="textLang" data-test="steps">
              <li v-for="(step, i) in t.steps" :key="i">
                {{ step.text }}
                <ContentLink v-if="step.link" :link="step.link" />
              </li>
            </ol>
          </section>

          <section v-if="t.portals.length" class="card">
            <h2>{{ m.board }}</h2>
            <ul class="board" :lang="textLang" data-test="board">
              <li v-for="portal in t.portals" :key="portal.url">
                <ExternalLink :href="portal.url"><strong>{{ portal.name }}</strong></ExternalLink>
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
                <ExternalLink v-if="note.source.kind === 'regulation'" :href="note.source.url" :lang="textLang"
                  >{{ note.source.document }}, {{ note.source.clause }}</ExternalLink
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
                <ExternalLink :href="citation.url">{{ citation.document }}, {{ citation.clause }}</ExternalLink>
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
            <ExternalLink class="btn primary open-portal" :href="t.portal.url" data-test="open-portal">{{ m.openPortal(t.portal.name) }}</ExternalLink>
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
/* One guide, as in the UI prototypes (guides.html): numbered steps on the left, where and when on the right. */
.guide-page {
  max-width: 1080px;
  margin: 0 auto;
  display: grid;
  gap: 12px;
}
.crumbs {
  margin: 0;
  font-size: 13px;
  color: var(--ink-3);
}
.crumbs a {
  font-weight: 600;
  text-decoration: none;
}
.crumbs a:hover {
  color: var(--ink);
}
.head {
  display: grid;
  gap: 10px;
  margin-bottom: 18px;
}
.head p {
  margin: 0;
  color: var(--ink-2);
  max-width: 70ch;
}
h2 {
  font-size: 16px;
  margin: 0 0 10px;
}
.column h2 + h2,
.column p + h2,
.column ul + h2 {
  margin-top: 16px;
}
h3 {
  font-size: 14.5px;
  margin: 0 0 4px;
}
.layout {
  display: grid;
  gap: 18px;
}
@media (min-width: 900px) {
  .layout {
    grid-template-columns: minmax(0, 1fr) 320px;
    align-items: start;
  }
}
.column {
  display: grid;
  gap: 18px;
  min-width: 0;
}
.card > p,
.note p {
  margin: 0 0 8px;
}
.card ul {
  margin: 0;
  padding-left: 1.2em;
}
.steps {
  counter-reset: step;
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 12px;
}
.steps li {
  counter-increment: step;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}
.steps li::before {
  content: counter(step);
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: var(--acc-bg);
  color: var(--acc-ink);
  font: 700 15px var(--display);
}
.board {
  list-style: none;
  margin: 0;
  padding: 0 !important;
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
}
.board li {
  display: grid;
  gap: 2px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--surface-2);
  font-size: 13.5px;
}
.note + .note {
  border-top: 1px solid var(--line);
  padding-top: 10px;
}
.source {
  font-size: 13px;
  color: var(--ink-3);
}
.host {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--info);
}
.callout {
  display: block;
  margin: 0;
}
.callout.warn {
  border-color: color-mix(in oklab, var(--warn) 45%, var(--edge));
}
.callout.warn p {
  margin: 4px 0 0;
}
.open-portal {
  white-space: normal;
  text-align: center;
  min-height: 42px;
  margin-top: 4px;
}
.meta {
  font-size: 13px;
  color: var(--ink-3);
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
</style>
