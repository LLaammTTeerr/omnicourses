<script setup lang="ts">
defineProps<{ id: string; errors: readonly string[] | undefined }>();
</script>

<template>
  <p v-if="errors?.length" :id="id" class="field-error" lang="en" data-test="field-error" :data-field="id">
    <span v-for="error in errors" :key="error">{{ error }}</span>
  </p>
</template>

<style scoped>
.field-error[data-test='field-error'] { display: grid; gap: 2px; overflow-wrap: anywhere; }
</style>
