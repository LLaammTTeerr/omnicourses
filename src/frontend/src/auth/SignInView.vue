<script setup lang="ts">
import { nextTick, reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { statusOf } from '../api.js';
import { useMessages } from '../locale.js';
import { usePageTitle } from '../page-title.js';
import Icon from '../shell/Icon.vue';
import { looksLikeEmail } from './api.js';
import AuthFrame from './AuthFrame.vue';
import { AUTH_MESSAGES } from './messages.js';
import { afterSignIn } from './redirect.js';
import { useAuth } from './store.js';

// F1 sign-in (issue #13). Then the page the guard came from, or the dashboard.
const auth = useAuth();
const route = useRoute();
const router = useRouter();
const m = useMessages(AUTH_MESSAGES);

const email = ref('');
const password = ref('');
const errors = reactive<{ email?: string; password?: string }>({});
const failure = ref<string | null>(null);
const busy = ref(false);

async function submit(): Promise<void> {
  failure.value = null;
  errors.email = looksLikeEmail(email.value) ? undefined : m.value.emailInvalid;
  errors.password = password.value ? undefined : m.value.passwordRequired;
  if (errors.email || errors.password) {
    await nextTick();
    document.getElementById(errors.email ? 'sign-in-email' : 'sign-in-password')?.focus();
    return;
  }
  busy.value = true;
  try {
    await auth.signIn({ email: email.value.trim(), password: password.value });
    await router.replace(afterSignIn(route.query.redirect));
  } catch (e) {
    const status = statusOf(e);
    // ADR 0002: one answer for an unknown email and a wrong password.
    if (status === 401) failure.value = m.value.wrongCredentials;
    else if (status === 429) failure.value = m.value.rateLimited;
    else if (status === 400) failure.value = m.value.checkFields;
    else {
      console.error('Signing in failed:', e);
      failure.value = m.value.unreachable;
    }
  } finally {
    busy.value = false;
  }
}

usePageTitle(() => m.value.signIn);
</script>

<template>
  <AuthFrame tone="ink">
    <div>
      <h1>{{ m.signInTitle }}</h1>
      <p class="t2 lead">{{ m.signInLead }}</p>
    </div>
    <form class="auth-fields" novalidate :aria-busy="busy" @submit.prevent="submit">
      <div class="field">
        <label for="sign-in-email">{{ m.email }}</label>
        <input
          id="sign-in-email"
          v-model="email"
          class="input"
          type="email"
          autocomplete="email"
          placeholder="ban@example.com"
          required
          :aria-invalid="errors.email ? 'true' : undefined"
          :aria-describedby="errors.email ? 'sign-in-email-error' : undefined"
        />
        <small v-if="errors.email" id="sign-in-email-error" class="field-error">{{ errors.email }}</small>
      </div>
      <div class="field">
        <label for="sign-in-password">{{ m.password }}</label>
        <input
          id="sign-in-password"
          v-model="password"
          class="input"
          type="password"
          autocomplete="current-password"
          required
          :aria-invalid="errors.password ? 'true' : undefined"
          :aria-describedby="errors.password ? 'sign-in-password-error' : undefined"
        />
        <small v-if="errors.password" id="sign-in-password-error" class="field-error">{{ errors.password }}</small>
      </div>
      <p v-if="failure" class="callout bad small" role="alert" data-test="failure"><Icon name="alert" size="sm" /><span>{{ failure }}</span></p>
      <button class="btn primary block big" type="submit" :disabled="busy">
        {{ busy ? m.signingIn : m.signIn }} <Icon name="right" size="sm" />
      </button>
    </form>
    <p class="small t2">
      {{ m.noAccount }} <RouterLink class="link" :to="{ name: 'sign-up', query: route.query.redirect ? { redirect: route.query.redirect } : {} }">{{ m.createAccount }}</RouterLink>
    </p>
    <p class="xs t3">{{ m.noPortalPassword }}</p>

    <template #art>
      <span class="chip">{{ m.signInArtChip }}</span>
      <b>{{ m.signInArt }}</b>
      <p>{{ m.signInArtText }}</p>
    </template>
  </AuthFrame>
</template>

<style>
.auth-fields { display: grid; gap: 14px; }
.auth-fields .field > label { font-weight: 650; font-size: 13.5px; }
.auth-form .lead { margin-top: 8px; }
</style>
