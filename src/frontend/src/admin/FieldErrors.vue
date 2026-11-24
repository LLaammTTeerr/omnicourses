<script setup lang="ts">
// The API's own messages for one field of a form (400 validation_failed), under that field. The field points here
// with aria-describedby and is marked aria-invalid; ProblemNote says, in the language on screen, that nothing was
// saved. The messages are English: the API sends no code per field (ADR 0011).
defineProps<{ id: string; errors: readonly string[] | undefined }>();
</script>

<template>
  <p v-if="errors?.length" :id="id" class="field-error" lang="en" data-test="field-error" :data-field="id">
    <span v-for="error in errors" :key="error">{{ error }}</span>
  </p>
</template>

<style>
.field-error[data-test='field-error'] { display: grid; gap: 2px; overflow-wrap: anywhere; }
</style>
