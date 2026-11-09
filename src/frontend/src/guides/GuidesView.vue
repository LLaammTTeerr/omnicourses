<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useAsyncLoad } from '../async-load.js';
import ExternalLink from '../components/ExternalLink.vue';
import { formatDate, LANGUAGES, useLocale, useMessages } from '../locale.js';
import { usePageTitle } from '../page-title.js';
import { fetchGuides, GUIDE_GROUPS, type GuideGroup } from './api.js';
import LoadFailed from './LoadFailed.vue';
import { GUIDE_MESSAGES } from './messages.js';
import { pickText } from './pick-text.js';
import { matches } from './search.js';

// UC-10 steps 1–3, A1 and A2: browse and search the guides, signed in or not.
const locale = useLocale();
const m = useMessages(GUIDE_MESSAGES);

const { status, data: guides, reload } = useAsyncLoad('the guides', fetchGuides);
const query = ref('');

const sections = computed(() => {
  const entries = (guides.value ?? [])
    .filter((guide) => matches(guide, query.value))
    .flatMap((guide) => {
      const picked = pickText(guide.texts, locale.lang);
      return picked ? [{ guide, ...picked }] : [];
    });
  const collator = new Intl.Collator(LANGUAGES[locale.lang].tag);
  return GUIDE_GROUPS.map((group) => ({
    group,
    entries: entries.filter((e) => e.guide.group === group).sort((a, b) => collator.compare(a.text.title, b.text.title)),
  })).filter((section) => section.entries.length > 0);
});

const groupsWithGuides = computed(() => GUIDE_GROUPS.filter((group) => guides.value?.some((g) => g.group === group)));

const groupId = (group: GuideGroup) => `group-${group}`;

// UC-10 A2.
async function browse(group: GuideGroup): Promise<void> {
  query.value = '';
  await nextTick();
  document.getElementById(groupId(group))?.focus();
}

usePageTitle(() => m.value.listTitle);
</script>

<template>
  <section class="guides" :aria-busy="status === 'loading'">
    <h1>{{ m.listTitle }}</h1>
    <p class="intro">{{ m.listIntro }}</p>
    <p class="note">{{ m.noPortalAccess }}</p>

    <div class="search">
      <label for="guide-search">{{ m.searchLabel }}</label>
      <input
        id="guide-search"
        v-model="query"
        type="search"
        :placeholder="m.searchPlaceholder"
        autocomplete="off"
        aria-describedby="guide-search-hint"
        aria-controls="guide-results"
      />
      <small id="guide-search-hint">{{ m.searchHint }}</small>
    </div>

    <div id="guide-results">
      <LoadFailed v-if="status === 'failed'" @retry="reload" />
      <p v-else-if="guides === null">{{ m.loading }}</p>
      <p v-else-if="guides.length === 0">{{ m.noGuides }}</p>
      <div v-else-if="sections.length === 0" class="card" role="status" data-test="no-match">
        <p><strong>{{ m.noMatch }}</strong></p>
        <p>{{ m.browseGroups }}</p>
        <ul class="groups">
          <li v-for="group in groupsWithGuides" :key="group">
            <button type="button" @click="browse(group)">{{ m.groups[group] }}</button>
          </li>
        </ul>
      </div>
      <template v-else>
        <section v-for="{ group, entries } in sections" :key="group" class="group" :aria-labelledby="groupId(group)">
          <h2 :id="groupId(group)" tabindex="-1">{{ m.groups[group] }}</h2>
          <ul class="entries">
            <li v-for="entry in entries" :key="entry.guide.id" class="card entry" :data-test="`guide-${entry.guide.id}`">
              <RouterLink class="title" data-test="title" :to="{ name: 'guide', params: { id: entry.guide.id } }" :lang="entry.lang">
                {{ entry.text.title }}
              </RouterLink>
              <p class="meta">
                <span :lang="entry.lang">{{ entry.text.portal.name }}</span> · {{ m.account }}
                <span :lang="entry.lang">{{ entry.text.portal.account }}</span>
              </p>
              <p class="chips">
                <span v-if="entry.text.outOfDate" class="chip warn">{{ m.outOfDateChip }}</span>
                <span v-else class="chip">{{ m.checkedOn(formatDate(entry.text.lastCheckedOn, locale.lang)) }}</span>
                <span v-if="entry.fallback" class="chip">{{ m.onlyOtherLanguage }}</span>
              </p>
              <ExternalLink class="portal" data-test="portal" :href="entry.text.portal.url">{{ m.openPortal(entry.text.portal.name) }}</ExternalLink>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </section>
</template>

<style scoped>
/* The guide list of the UI prototypes (guides.html): a large search box, then each task group's guides as cards. */
.guides {
  max-width: 1080px;
  margin: 0 auto;
  display: grid;
  gap: 18px;
}
.intro {
  color: var(--ink-2);
  max-width: 70ch;
}
.note {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  color: var(--ink-3);
  font-size: 13.5px;
}
.search {
  display: grid;
  gap: 8px;
  padding: 20px 22px;
  background: var(--surface);
  border: 1px solid var(--edge);
  border-radius: var(--r);
  box-shadow: var(--shadow);
}
.search label {
  font-weight: 650;
  font-size: 17px;
}
.search input {
  font: inherit;
  font-size: 16px;
  width: 100%;
  min-height: 52px;
  padding: 10px 14px;
  border: 1px solid var(--edge-strong);
  border-radius: 10px;
  background: var(--surface);
}
.search input:focus {
  outline: none;
  border-color: var(--info);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--info) 22%, transparent);
}
.search small {
  color: var(--ink-3);
}
#guide-results {
  display: grid;
  gap: 22px;
}
.group h2 {
  margin: 0 0 10px;
  font-size: 17px;
}
.entries,
.groups {
  list-style: none;
  margin: 0;
  padding: 0;
}
.entries {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
}
.groups {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.groups button {
  font: inherit;
  font-weight: 600;
  font-size: 14px;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 9px;
  border: 1px solid var(--edge-strong);
  background: var(--surface);
  cursor: pointer;
}
.groups button:hover {
  background: var(--surface-2);
}
.entry {
  display: grid;
  gap: 8px;
  align-content: start;
  padding: 16px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.entry:hover {
  border-color: var(--edge-strong);
  box-shadow: var(--shadow-lg);
}
.title {
  font-weight: 650;
  font-size: 15.5px;
  line-height: 1.3;
  color: var(--ink);
  text-decoration: none;
}
.title:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.meta {
  margin: 0;
  color: var(--ink-3);
  font-size: 13px;
}
.meta,
.title,
.portal {
  overflow-wrap: anywhere;
}
.chips {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  white-space: normal;
}
.portal {
  justify-self: start;
  color: var(--info);
  font-weight: 600;
  font-size: 14px;
  text-decoration: none;
}
.portal:hover {
  text-decoration: underline;
}
</style>
