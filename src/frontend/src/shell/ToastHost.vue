<script setup lang="ts">
import { useToast } from './toast.js';

const toast = useToast();
</script>

<template>
  <div class="toast" :class="{ show: toast.message }" role="status" aria-live="polite" data-test="toast">{{ toast.message }}</div>
</template>
