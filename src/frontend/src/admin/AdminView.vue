<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { useMessages } from '../locale.js';
import { usePageTitle } from '../page-title.js';
import Icon from '../shell/Icon.vue';
import { ADMIN_MESSAGES } from './messages.js';
import { ADMIN_SECTIONS, opens } from './sections.js';
import { useAdminAccess } from './store.js';

// F12 administration (ADR 0011, UC-11; UI prototypes: admin.html): the frame around the sections. It asks the API
// for the user's own grants on every visit and offers the sections they hold. A user with no grant, or one who
// opens a section they do not hold, is told so in words (UC-11 A4). Hiding a section is a convenience only: the
// API checks the grant on every request. When the API refuses a save for lack of a permission, the grants have
// changed under an open screen: the page then says so and keeps that screen as it was, with what was typed, until
// the user has read it. Only the navigation follows at once.
const access = useAdminAccess();
const route = useRoute();
const router = useRouter();
const m = useMessages(ADMIN_MESSAGES);

// Until this visit's answer is in: a grant given or revoked since the last one must not flash the wrong page.
const checking = ref(true);
async function check(): Promise<void> {
  checking.value = true;
  await access.load({ fresh: true });
  checking.value = false;
}
onMounted(check);

const sections = computed(() => ADMIN_SECTIONS.filter((section) => opens(section, access.holds)));
/** The section the address names, if any. */
const wanted = computed(() => ADMIN_SECTIONS.find((section) => section.route === route.name) ?? null);
const denied = computed(() => (wanted.value && !opens(wanted.value, access.holds) ? wanted.value : null));
/** The permissions a denied section needs, by name: "A" or "A or B". */
const deniedNames = computed(() => (denied.value ? m.value.anyOf(denied.value.permissions.map((permission) => m.value.permissions[permission])) : ''));

// A save refused for lack of a permission (useWrites keeps it in the store): the section it came from stays on
// screen, whatever the grants are now, until the user asks for the page as their permissions stand.
const pinnedRoute = ref<string | null>(null);
watch(
  () => access.refusal,
  (refusal) => (pinnedRoute.value = refusal ? String(route.name) : null),
);
// Leaving the section is the user's own choice: the message stays, the section is no longer held.
watch(
  () => route.name,
  () => (pinnedRoute.value = null),
);
const pinned = computed(() => access.refusal !== null && pinnedRoute.value === route.name);
// The message is about this visit: it does not wait for the next one.
onBeforeUnmount(() => (access.refusal = null));
async function release(): Promise<void> {
  access.refusal = null;
  // The button is gone, and maybe the section with it: the focus goes to the page's title.
  await nextTick();
  document.getElementById('admin-title')?.focus();
}

// /admin itself opens the first section the user holds.
watch(
  [() => route.name, sections, checking],
  () => {
    if (!checking.value && route.name === 'admin' && sections.value[0]) void router.replace({ name: sections.value[0].route });
  },
  { immediate: true },
);

usePageTitle(() => m.value.title);
</script>

<template>
  <div class="page admin-page">
    <header class="page-head">
      <div>
        <h1 id="admin-title" tabindex="-1">{{ m.title }}</h1>
        <p>{{ m.lead }}</p>
      </div>
      <ul v-if="!checking && access.any" class="admin-held" :aria-label="m.yourPermissions" data-test="admin-held">
        <li v-for="grant in access.grants?.programs" :key="grant.programId" class="chip ink"><Icon name="key" size="sm" />{{ m.programGrant(grant.programCode) }}</li>
        <li v-for="grant in access.grants?.permissions" :key="grant.permission" class="chip ink"><Icon name="key" size="sm" />{{ m.permissions[grant.permission] }}</li>
      </ul>
    </header>

    <p v-if="checking" class="t3" role="status" data-test="admin-loading">{{ m.loading }}</p>
    <template v-else>
      <div v-if="access.refusal" class="callout bad admin-refused" role="alert" data-test="admin-refused" :data-permission="access.refusal.permission ?? ''">
        <Icon name="alert" />
        <div>
          <p>{{ m.refused(access.refusal.permission && m.permissions[access.refusal.permission]) }}</p>
          <p v-if="pinned">{{ m.refusedKept }}</p>
          <button class="btn sm" type="button" data-test="admin-refused-close" @click="release">{{ pinned ? m.refusedReload : m.close }}</button>
        </div>
      </div>

      <p v-if="!access.grants && !pinned" class="callout bad" role="alert" data-test="admin-grants-failed">
        <Icon name="alert" /><span>{{ m.grantsFailed }} <button class="btn sm" type="button" @click="check">{{ m.retry }}</button></span>
      </p>
      <section v-else-if="!access.any && !pinned" class="card admin-none" aria-labelledby="admin-none-title" data-test="admin-no-permission">
        <span class="ic" aria-hidden="true"><Icon name="lock" /></span>
        <h2 id="admin-none-title">{{ m.noPermissionTitle }}</h2>
        <p class="t2">{{ m.noPermissionText }}</p>
        <p class="t2">{{ m.noPermissionHow }}</p>
        <RouterLink class="btn" :to="{ name: 'settings', hash: '#profile' }">{{ m.openSettings }}</RouterLink>
      </section>
      <template v-else>
        <nav v-if="sections.length" class="seg admin-tabs" :aria-label="m.sections" data-test="admin-tabs">
          <RouterLink v-for="section in sections" :key="section.id" :to="{ name: section.route }" :data-test="`admin-tab-${section.id}`">
            {{ m.sectionNames[section.id] }}
          </RouterLink>
        </nav>
        <p v-if="denied && !pinned" class="callout bad" role="alert" data-test="admin-section-denied" :data-permission="denied.permissions.join(' ')">
          <Icon name="lock" /><span>{{ m.sectionDenied(deniedNames) }}</span>
        </p>
        <RouterView v-else />
      </template>
    </template>
  </div>
</template>

<style>
.admin-page { max-width: 1180px; }
.admin-held { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.admin-tabs { justify-self: start; }
.admin-tabs a { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 9px; font-weight: 650; font-size: 13.5px; color: var(--ink-2); text-decoration: none; }
.admin-tabs a.router-link-active { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); outline: 1px solid var(--edge); }
.admin-none { display: grid; gap: 12px; justify-items: start; max-width: 640px; }
.admin-refused > div { display: grid; gap: 6px; justify-items: start; min-width: 0; }
#admin-title:focus { outline: none; }
.admin-none .ic { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--surface-3); color: var(--ink-2); }

/* Shared by the sections: a section's column, its lookup or link form, its tables, and the forms of its dialogs. */
.admin-section { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; }
.admin-tools { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; padding: 6px 22px 20px; }
.link-form { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; }
.link-form .field { flex: 0 1 220px; min-width: 0; }
.link-form label { font-weight: 650; font-size: 13.5px; }
.admin-section .table th[scope='row'] { text-align: left; font-size: 14px; color: var(--ink); padding: 12px 14px; border-bottom: 1px solid var(--line); white-space: normal; font-weight: 650; }
.admin-section .table tr:last-child th[scope='row'], dialog.modal .table tr:last-child th[scope='row'] { border-bottom: 0; }
.admin-section .row-acts { display: flex; justify-content: flex-end; align-items: center; gap: 6px; }
.admin-form { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.admin-form label, .admin-form legend { font-weight: 650; font-size: 13.5px; }
.admin-form .check { font-weight: 400; font-size: 14px; }
.admin-choices { border: 0; margin: 0; padding: 0; min-width: 0; }
.admin-choices legend { padding: 0; margin-bottom: 6px; }
.admin-form textarea.input { resize: vertical; min-height: 76px; }
@media (max-width: 620px) {
  .admin-tools { padding: 6px 16px 16px; }
  .link-form .field { flex: 1 1 100%; }
}
/*
 * Narrow: a row of an administration table is a card. The column heads leave the screen (kept for screen readers),
 * each value shows its column's name from data-label, and the row's actions stay in view with no sideways scroll.
 */
@media (max-width: 760px) {
  .admin-cards thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .admin-cards, .admin-cards tbody { display: block; }
  .admin-cards tr { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 12px; padding: 12px 16px; border-top: 1px solid var(--line); }
  .admin-cards tbody tr:first-child { border-top: 0; }
  .admin-section .admin-cards tr > th[scope='row'], .admin-section .admin-cards tr > td { display: block; padding: 0; border: 0; text-align: left; background: none; min-width: 0; }
  .admin-cards td[data-label]::before { content: attr(data-label); display: block; font-size: 12px; font-weight: 650; color: var(--ink-3); }
  .admin-cards th[scope='row'], .admin-cards td.acts, .admin-cards td.wide { grid-column: 1 / -1; }
  .admin-section .admin-cards .row-acts { justify-content: flex-start; flex-wrap: wrap; }
}
</style>
