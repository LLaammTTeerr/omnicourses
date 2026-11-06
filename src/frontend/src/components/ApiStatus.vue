<script setup lang="ts">
import { fetchHealth } from '../api.js';
import { useAsyncLoad } from '../async-load.js';

const { status, data: health, error } = useAsyncLoad('the API status', fetchHealth);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
</script>

<template>
  <p v-if="status === 'failed'" data-test="status">API unreachable: {{ message(error) }}</p>
  <p v-else-if="health" data-test="status">
    API {{ health.status }} · database {{ health.database }}
    <span v-if="health.postgresVersion">(PostgreSQL {{ health.postgresVersion }})</span>
  </p>
  <p v-else data-test="status">Checking API…</p>
</template>
