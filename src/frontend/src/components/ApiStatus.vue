<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { fetchHealth, type Health } from '../api.js';

const props = defineProps<{ load?: () => Promise<Health> }>();

const health = ref<Health | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    health.value = await (props.load ?? fetchHealth)();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <p v-if="error" data-test="status">API unreachable: {{ error }}</p>
  <p v-else-if="health" data-test="status">
    API {{ health.status }} · database {{ health.database }}
    <span v-if="health.postgresVersion">(PostgreSQL {{ health.postgresVersion }})</span>
  </p>
  <p v-else data-test="status">Checking API…</p>
</template>
