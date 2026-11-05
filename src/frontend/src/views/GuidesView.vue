<script setup lang="ts">
import { computed, nextTick, onActivated, onDeactivated, onMounted, ref, watchEffect } from 'vue';
import { RouterLink } from 'vue-router';
import { fetchGuides, GUIDE_GROUPS, type GuideGroup, type GuideListItem } from '../guides-api.js';
import { GUIDE_MESSAGES } from '../guides/messages.js';
import { pickText } from '../guides/pick-text.js';
import { matches } from '../guides/search.js';
import { formatDate, useLocale, useMessages } from '../locale.js';

// UC-10 steps 1–3, A1 and A2: browse and search the guides, signed in or not.
const props = defineProps<{ load?: () => Promise<GuideListItem[]> }>();
const locale = useLocale();
const m = useMessages(GUIDE_MESSAGES);

const guides = ref<GuideListItem[] | null>(null);
// A failed load shows a plain sentence; the details go to the console.
const failed = ref(false);
const query = ref('');

async function load(): Promise<void> {
  failed.value = false;
  try {
    guides.value = await (props.load ?? fetchGuides)();
  } catch (e) {
    console.error('Loading the guides failed:', e);
    failed.value = true;
  }
}
onMounted(load);

// The guides that match, under their task group in plan order, each in the screen language where written.
const sections = computed(() => {
  const entries = (guides.value ?? [])
    .filter((guide) => matches(guide, query.value))
    .flatMap((guide) => {
      const picked = pickText(guide.texts, locale.lang);
      return picked ? [{ guide, ...picked }] : [];
    });
  const collator = new Intl.Collator(locale.lang);
  return GUIDE_GROUPS.map((group) => ({
    group,
    entries: entries.filter((e) => e.guide.group === group).sort((a, b) => collator.compare(a.text.title, b.text.title)),
  })).filter((section) => section.entries.length > 0);
});

const groupsWithGuides = computed(() => GUIDE_GROUPS.filter((group) => guides.value?.some((g) => g.group === group)));

// A2: clear the search and move to the group's heading.
async function browse(group: GuideGroup): Promise<void> {
  query.value = '';
  await nextTick();
  document.getElementById(`group-${group}`)?.focus();
}

// App.vue keeps this page alive while a guide is open: only set the title while on screen.
const onScreen = ref(true);
onActivated(() => (onScreen.value = true));
onDeactivated(() => (onScreen.value = false));
watchEffect(() => {
  if (onScreen.value) document.title = `${m.value.listTitle} · OmniCourse`;
});
</script>

<template>
  <section class="guides" :aria-busy="guides === null && !failed">
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
      <p v-if="failed" role="alert">
        {{ m.loadFailed }} <button type="button" @click="load">{{ m.retry }}</button>
      </p>
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
        <section v-for="{ group, entries } in sections" :key="group" class="group" :aria-labelledby="`group-${group}`">
          <h2 :id="`group-${group}`" tabindex="-1">{{ m.groups[group] }}</h2>
          <ul class="entries">
            <li v-for="entry in entries" :key="entry.guide.id" class="card entry" :data-test="`guide-${entry.guide.id}`">
              <RouterLink class="title" :to="{ name: 'guide', params: { id: entry.guide.id } }" :lang="entry.lang">
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
              <a class="portal" :href="entry.text.portal.url" target="_blank" rel="noopener noreferrer">
                {{ m.openPortal(entry.text.portal.name) }}<span class="sr-only">{{ m.newTab }}</span>
              </a>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </section>
</template>

<style scoped>
.guides {
  max-width: 960px;
  margin: 0 auto;
  display: grid;
  gap: 16px;
}
h1 {
  margin: 0;
  font-size: 1.75rem;
}
.intro,
.note {
  margin: 0;
}
.note {
  color: #555;
  font-size: 0.9rem;
}
.search {
  display: grid;
  gap: 4px;
}
.search label {
  font-weight: 600;
}
.search input {
  font: inherit;
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #767676;
  border-radius: 6px;
}
.search small {
  color: #555;
}
#guide-results {
  display: grid;
  gap: 16px;
}
.group h2 {
  margin: 0 0 8px;
  font-size: 1.15rem;
}
.entries,
.groups {
  list-style: none;
  margin: 0;
  padding: 0;
}
.entries {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
}
.groups {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.card {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 12px 16px;
}
.entry {
  display: grid;
  gap: 6px;
  align-content: start;
}
.title {
  font-weight: 600;
  font-size: 1.05rem;
  color: #0b4f9c;
}
.meta {
  margin: 0;
  color: #444;
  font-size: 0.9rem;
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
  font-size: 0.8rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef1f5;
  color: #333;
}
.chip.warn {
  background: #fff4d6;
  color: #6b4500;
}
.portal {
  justify-self: start;
  color: #0b4f9c;
}
button {
  font: inherit;
  padding: 6px 12px;
  cursor: pointer;
}
</style>
