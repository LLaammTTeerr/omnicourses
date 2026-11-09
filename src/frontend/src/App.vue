<script setup lang="ts">
import { computed, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { useAuth } from './auth/store.js';
import { useMessages } from './locale.js';
import AppSidebar from './shell/AppSidebar.vue';
import { SHELL_MESSAGES } from './shell/messages.js';
import MobileBars from './shell/MobileBars.vue';
import PublicFooter from './shell/PublicFooter.vue';
import PublicHeader from './shell/PublicHeader.vue';
import { useSidebar } from './shell/sidebar.js';
import { useTheme } from './shell/theme.js';
import { useToast } from './shell/toast.js';
import ToastHost from './shell/ToastHost.vue';

const auth = useAuth();
const route = useRoute();
const router = useRouter();
const sidebar = useSidebar();
const toast = useToast();
const m = useMessages(SHELL_MESSAGES);
useTheme();

// The frame around the page (RouteMeta.layout in router.ts).
const layout = computed(() => {
  const wanted = route.meta.layout ?? 'public';
  if (wanted === 'auto') return auth.signedIn ? 'app' : 'public';
  return wanted;
});

// A session that ends while a private page is open (revoked on another device, expired): sign in, then come back.
watch(
  () => auth.signedIn,
  (signedIn) => {
    if (signedIn || route.meta.auth !== 'required') return;
    toast.show(m.value.sessionEnded);
    void router.replace({ name: 'sign-in', query: { redirect: route.fullPath } });
  },
);

// ADR 0004: tell the student that signing in cancelled their pending deletion.
watch(
  () => auth.accountRestored,
  (restored) => {
    if (!restored) return;
    toast.show(m.value.restored);
    auth.accountRestored = false;
  },
);
</script>

<template>
  <a class="skip" href="#main">{{ m.skip }}</a>
  <PublicHeader v-if="layout === 'public'" />
  <div :class="['frame', `frame-${layout}`, { 'side-mini': layout === 'app' && sidebar.mini }]">
    <AppSidebar v-if="layout === 'app'" />
    <div class="column">
      <MobileBars v-if="layout === 'app'" part="top" />
      <main id="main" tabindex="-1">
        <RouterView v-slot="{ Component, route: shown }">
          <KeepAlive><component :is="Component" v-if="shown.meta.keepAlive" /></KeepAlive>
          <component :is="Component" v-if="!shown.meta.keepAlive" />
        </RouterView>
      </main>
    </div>
  </div>
  <PublicFooter v-if="layout === 'public'" />
  <MobileBars v-if="layout === 'app'" part="tabs" />
  <ToastHost />
</template>

<style>
#main:focus { outline: none; }
.frame-public #main { padding: 32px clamp(16px, 4vw, 48px) 80px; }
.frame-app {
  display: grid; grid-template-columns: var(--side) minmax(0, 1fr); min-height: 100vh;
  transition: grid-template-columns 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.frame-app .column { min-width: 0; }
.frame-app #main { padding: 28px clamp(16px, 3.2vw, 44px) 80px; }
@media (max-width: 960px) {
  .frame-app { display: block; }
  .frame-app .side { display: none; }
  .frame-app #main { padding-top: 20px; padding-bottom: 110px; }
}
</style>
