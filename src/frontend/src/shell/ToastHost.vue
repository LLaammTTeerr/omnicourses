<script setup lang="ts">
import { useToast } from './toast.js';

// Always in the page, so screen readers announce each new message in this live region.
const toast = useToast();
</script>

<template>
  <div class="toast" :class="{ show: toast.message }" role="status" aria-live="polite" data-test="toast">{{ toast.message }}</div>
</template>
