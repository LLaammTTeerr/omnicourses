<script setup lang="ts">
import { ref, watch } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import { statusOf } from '../api.js';
import { useAuth } from '../auth/store.js';
import ModalDialog from '../components/ModalDialog.vue';
import { formatDateTime, useLocale, useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { SHELL_MESSAGES } from '../shell/messages.js';
import { useToast } from '../shell/toast.js';
import { deleteAccount } from './api.js';
import { SETTINGS_MESSAGES } from './messages.js';

// ADR 0004: the password again, then every session is revoked and the account is purged after the grace period
// unless the student signs in again. 403 is a wrong password: the student stays signed in.
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const auth = useAuth();
const locale = useLocale();
const router = useRouter();
const toast = useToast();
const m = useMessages(SETTINGS_MESSAGES);
const shell = useMessages(SHELL_MESSAGES);

const password = ref('');
const error = ref<string | null>(null);
const busy = ref(false);

watch(
  () => props.open,
  () => {
    password.value = '';
    error.value = null;
  },
);

// Busy, the dialog refuses Escape with `closedby="none"`, which leaves the Android back gesture to the browser:
// history back. Stay until the deletion answers, so a wrong password is said. A 401 has signed the student out.
onBeforeRouteLeave(() => !busy.value || !auth.signedIn);

async function confirm(): Promise<void> {
  if (!password.value || busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    const { purgeAfter } = await auth.authed((token) => deleteAccount(token, { password: password.value }));
    busy.value = false;
    // Every session is gone on the server: leave the private pages first, then forget this one.
    await router.push({ name: 'home' });
    auth.clear();
    toast.show(m.value.deleted(formatDateTime(purgeAfter, locale.lang)));
  } catch (e) {
    const status = statusOf(e);
    if (status === 401) return; // Signed out elsewhere: App.vue takes the student to sign in.
    if (status === 403) error.value = m.value.wrongPassword;
    else if (status === 429) error.value = m.value.rateLimited;
    else {
      console.error('Deleting the account failed:', e);
      // A timeout: the request may have reached the server and revoked every session (ADR 0004).
      error.value = e instanceof DOMException && e.name === 'TimeoutError' ? m.value.noAnswer : m.value.unreachable;
    }
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <!-- Busy: Keep is disabled and Escape is refused, so a wrong password is said in the dialog, not lost. -->
  <ModalDialog :open="open" role="alertdialog" labelledby="delete-title" describedby="delete-body" :busy="busy" :busy-text="shell.working" @close="emit('close')">
    <span class="ic" aria-hidden="true"><Icon name="trash" /></span>
    <h2 id="delete-title">{{ m.deleteDialogTitle }}</h2>
    <p id="delete-body" class="t2">{{ m.deleteDialogBody }}</p>
    <form class="stack delete-form" novalidate @submit.prevent="confirm">
      <div class="field">
        <label for="delete-password">{{ m.deletePassword }}</label>
        <input
          id="delete-password"
          v-model="password"
          class="input"
          type="password"
          autocomplete="current-password"
          required
          autofocus
          :aria-invalid="error === m.wrongPassword ? 'true' : undefined"
          :aria-describedby="error ? 'delete-error' : undefined"
        />
      </div>
      <p v-if="error" id="delete-error" class="callout bad small" role="alert"><Icon name="alert" size="sm" /><span>{{ error }}</span></p>
      <div class="acts">
        <button class="btn" type="button" :disabled="busy" @click="emit('close')">{{ m.keep }}</button>
        <button class="btn danger" type="submit" :disabled="!password || busy">
          <Icon name="trash" size="sm" />{{ busy ? m.deleting : m.delete }}
        </button>
      </div>
    </form>
  </ModalDialog>
</template>

<style>
.delete-form { gap: 14px; }
</style>
