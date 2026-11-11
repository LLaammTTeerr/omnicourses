<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { statusOf } from '../api.js';
import ExternalLink from '../components/ExternalLink.vue';
import { useMessages } from '../locale.js';
import { usePageTitle } from '../page-title.js';
import Icon from '../shell/Icon.vue';
import { DISPLAY_NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './api.js';
import AuthFrame from './AuthFrame.vue';
import { AUTH_MESSAGES, looksLikeEmail } from './messages.js';
import { passwordStrength, strengthFill } from './password-strength.js';
import { afterSignIn } from './redirect.js';
import { useAuth } from './store.js';

// F1 sign-up (issue #13), with the consent the API records as consent_at (Luật 91/2025/QH15). The form checks what
// SignUpDto checks, so a 400 should not happen; if it does, the API's answer wins.
const auth = useAuth();
const route = useRoute();
const router = useRouter();
const m = useMessages(AUTH_MESSAGES);

type Field = 'displayName' | 'email' | 'password' | 'consent';
const form = reactive({ displayName: '', email: '', password: '', consent: false });
const errors = reactive<Partial<Record<Field, string>>>({});
const failure = ref<'taken' | string | null>(null);
const busy = ref(false);

const strength = computed(() => passwordStrength(form.password));
const strengthText = computed(() => {
  if (form.password.length === 0) return m.value.passwordHint;
  if (strength.value === 'short') return m.value.passwordShort(PASSWORD_MIN_LENGTH - form.password.length);
  return `${m.value.strengthLabel}: ${m.value.strength[strength.value]}`;
});
const strengthColour = computed(() => ({ short: 'var(--bad)', weak: 'var(--bad)', fair: 'var(--warn)', strong: 'var(--ok)', 'very-strong': 'var(--ok)' })[strength.value]);

function check(): Partial<Record<Field, string>> {
  const name = form.displayName.trim();
  return {
    displayName: !name ? m.value.displayNameRequired : name.length > DISPLAY_NAME_MAX_LENGTH ? m.value.displayNameTooLong : undefined,
    email: looksLikeEmail(form.email) ? undefined : m.value.emailInvalid,
    password:
      form.password.length < PASSWORD_MIN_LENGTH
        ? m.value.passwordShort(PASSWORD_MIN_LENGTH - form.password.length)
        : form.password.length > PASSWORD_MAX_LENGTH
          ? m.value.passwordTooLong
          : undefined,
    consent: form.consent ? undefined : m.value.consentRequired,
  };
}

const describedBy = (field: Field, ...more: string[]) => [errors[field] ? `sign-up-${field}-error` : '', ...more].filter(Boolean).join(' ') || undefined;

async function submit(): Promise<void> {
  failure.value = null;
  Object.assign(errors, check());
  const firstInvalid = (['displayName', 'email', 'password', 'consent'] as const).find((field) => errors[field]);
  if (firstInvalid) {
    await nextTick();
    document.getElementById(`sign-up-${firstInvalid}`)?.focus();
    return;
  }
  busy.value = true;
  try {
    await auth.signUp({ displayName: form.displayName.trim(), email: form.email.trim(), password: form.password, acceptedTerms: true });
    await router.replace(afterSignIn(route.query.redirect));
  } catch (e) {
    const status = statusOf(e);
    if (status === 409) failure.value = 'taken';
    else if (status === 429) failure.value = m.value.rateLimited;
    else if (status === 400) failure.value = m.value.checkFields;
    else {
      console.error('Signing up failed:', e);
      failure.value = m.value.unreachable;
    }
  } finally {
    busy.value = false;
  }
}

usePageTitle(() => m.value.signUp);
</script>

<template>
  <AuthFrame tone="phys">
    <div>
      <h1>{{ m.signUpTitle }}</h1>
      <p class="t2 lead">{{ m.signUpLead }}</p>
    </div>
    <form class="auth-fields" novalidate :aria-busy="busy" @submit.prevent="submit">
      <div class="field">
        <label for="sign-up-displayName">{{ m.displayName }}</label>
        <input
          id="sign-up-displayName"
          v-model="form.displayName"
          class="input"
          autocomplete="nickname"
          :maxlength="DISPLAY_NAME_MAX_LENGTH"
          required
          :aria-invalid="errors.displayName ? 'true' : undefined"
          :aria-describedby="describedBy('displayName', 'sign-up-displayName-hint')"
        />
        <small id="sign-up-displayName-hint" class="hint">{{ m.displayNameHint }}</small>
        <small v-if="errors.displayName" id="sign-up-displayName-error" class="field-error">{{ errors.displayName }}</small>
      </div>
      <div class="field">
        <label for="sign-up-email">{{ m.email }}</label>
        <input
          id="sign-up-email"
          v-model="form.email"
          class="input"
          type="email"
          autocomplete="email"
          placeholder="ban@example.com"
          required
          :aria-invalid="errors.email ? 'true' : undefined"
          :aria-describedby="describedBy('email')"
        />
        <small v-if="errors.email" id="sign-up-email-error" class="field-error">{{ errors.email }}</small>
      </div>
      <div class="field">
        <label for="sign-up-password">{{ m.password }}</label>
        <input
          id="sign-up-password"
          v-model="form.password"
          class="input"
          type="password"
          autocomplete="new-password"
          :placeholder="m.passwordPlaceholder"
          required
          :aria-invalid="errors.password ? 'true' : undefined"
          :aria-describedby="describedBy('password', 'sign-up-password-strength')"
        />
        <span class="meter" aria-hidden="true"><i :style="{ width: `${strengthFill(form.password) * 100}%`, background: strengthColour }" /></span>
        <small id="sign-up-password-strength" class="hint" data-test="strength">{{ strengthText }}</small>
        <small v-if="errors.password" id="sign-up-password-error" class="field-error">{{ errors.password }}</small>
      </div>
      <div class="box">
        <label class="check">
          <input
            id="sign-up-consent"
            v-model="form.consent"
            type="checkbox"
            required
            :aria-invalid="errors.consent ? 'true' : undefined"
            :aria-describedby="describedBy('consent', 'sign-up-consent-detail')"
          />
          <span><b>{{ m.consent }}</b><br /><span id="sign-up-consent-detail" class="small t2">{{ m.consentDetail }}</span></span>
        </label>
        <!-- Outside the label, so a click opens the notice instead of ticking the box; a new tab keeps what was typed. -->
        <p class="small privacy-link">
          <ExternalLink class="link" :href="router.resolve({ name: 'privacy' }).href" data-test="privacy-link">{{ m.privacyLink }}</ExternalLink>
        </p>
        <small v-if="errors.consent" id="sign-up-consent-error" class="field-error">{{ errors.consent }}</small>
      </div>
      <p v-if="failure" class="callout bad small" role="alert" data-test="failure">
        <Icon name="alert" size="sm" />
        <span v-if="failure === 'taken'">
          {{ m.emailTaken }} <RouterLink class="link" :to="{ name: 'sign-in', query: route.query.redirect ? { redirect: route.query.redirect } : {} }">{{ m.signInInstead }}</RouterLink>
        </span>
        <span v-else>{{ failure }}</span>
      </p>
      <button class="btn primary block big" type="submit" :disabled="busy">
        {{ busy ? m.signingUp : m.signUp }} <Icon name="right" size="sm" />
      </button>
    </form>
    <p class="small t2">
      {{ m.haveAccount }} <RouterLink class="link" :to="{ name: 'sign-in', query: route.query.redirect ? { redirect: route.query.redirect } : {} }">{{ m.signIn }}</RouterLink>
    </p>
    <p class="xs t3">{{ m.noPortalPassword }}</p>

    <template #art>
      <span class="chip">{{ m.signUpArtChip }}</span>
      <b>{{ m.signUpArt }}</b>
      <p>{{ m.signUpArtText }}</p>
    </template>
  </AuthFrame>
</template>

<style scoped>
/* Lined up with the consent text: the checkbox's 20 px plus the label's 10 px gap. */
.privacy-link {
  margin: 6px 0 0 30px;
}
</style>
