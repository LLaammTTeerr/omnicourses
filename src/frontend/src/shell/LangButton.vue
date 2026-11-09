<script setup lang="ts">
import { computed } from 'vue';
import { LANGUAGES, useLocale } from '../locale.js';
import Icon from './Icon.vue';

// Names the language it switches to, in that language: "English" on a Vietnamese screen, "Tiếng Việt" on an
// English one. `short` shows only the code (EN, VI) where space is tight; the accessible name stays the full name.
defineProps<{ short?: boolean }>();
const locale = useLocale();
const other = computed(() => LANGUAGES[locale.lang].other);
</script>

<template>
  <button
    type="button"
    class="lang-btn"
    :lang="other"
    :aria-label="short ? LANGUAGES[other].name : undefined"
    :title="short ? LANGUAGES[other].name : undefined"
    @click="locale.set(other)"
  >
    <span class="ico"><Icon name="globe" /></span>
    <span class="tx">{{ short ? other.toUpperCase() : LANGUAGES[other].name }}</span>
  </button>
</template>
