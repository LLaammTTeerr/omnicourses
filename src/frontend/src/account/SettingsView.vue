<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { reportFailure } from '../api.js';
import { useAsyncLoad } from '../async-load.js';
import { listSessions, revokeSession, type Session } from '../auth/api.js';
import { useAuth } from '../auth/store.js';
import ModalDialog from '../components/ModalDialog.vue';
import { GROUPS, groupClass } from '../groups.js';
import { formatDateTime, LANGUAGES, useLocale, useMessages, type Lang } from '../locale.js';
import { COMMON_MESSAGES } from '../messages.js';
import { usePageTitle } from '../page-title.js';
import Icon from '../shell/Icon.vue';
import { useTheme } from '../shell/theme.js';
import { useToast } from '../shell/toast.js';
import { EXPORT_FILE_NAME, exportAccount, saveFile } from './api.js';
import StudySettings from '../onboarding/StudySettings.vue';
import DeleteAccountDialog from './DeleteAccountDialog.vue';
import { SETTINGS_MESSAGES } from './messages.js';
import { describeDevice } from './user-agent.js';

// Settings (UI prototypes: settings.html), the parts with an API today: the onboarding answers (UC-01 A9), sessions
// (ADR 0002), theme, language, export and deletion (ADR 0004), sign-out. Profile edits, password change and AI
// consent wait for their API.
const auth = useAuth();
const locale = useLocale();
const router = useRouter();
const theme = useTheme();
const toast = useToast();
const m = useMessages(SETTINGS_MESSAGES);
const common = useMessages(COMMON_MESSAGES);

const sessions = useAsyncLoad('the sessions', () => auth.authed(listSessions));
// The current session first, then the newest.
const sorted = computed(() =>
  [...(sessions.data.value ?? [])].sort((a, b) => Number(b.current) - Number(a.current) || b.createdAt.localeCompare(a.createdAt)),
);
const deviceName = (session: Session) => describeDevice(session.userAgent) ?? m.value.unknownDevice;
const when = (iso: string) => formatDateTime(iso, locale.lang);

const revoking = ref<Session | null>(null);
const revokeBusy = ref(false);
async function revoke(): Promise<void> {
  const session = revoking.value;
  if (!session) return;
  revokeBusy.value = true;
  try {
    await auth.authed((token) => revokeSession(token, session.id));
    toast.show(m.value.revoked);
    revoking.value = null;
    await sessions.reload();
  } catch (e) {
    revoking.value = null;
    if (reportFailure('Revoking a session', e)) toast.show(m.value.revokeFailed);
  } finally {
    revokeBusy.value = false;
  }
}

const exporting = ref(false);
const exportFailed = ref(false);
async function download(): Promise<void> {
  exporting.value = true;
  exportFailed.value = false;
  try {
    saveFile(await auth.authed(exportAccount), EXPORT_FILE_NAME);
    toast.show(m.value.exported(EXPORT_FILE_NAME));
  } catch (e) {
    exportFailed.value = reportFailure('Exporting the account', e);
  } finally {
    exporting.value = false;
  }
}

const deleting = ref(false);

async function signOut(): Promise<void> {
  // Leave the private page first, so App.vue does not read the sign-out as a session that ended by itself.
  await router.push({ name: 'home' });
  await auth.signOut();
  toast.show(m.value.signedOut);
}

const languages = Object.keys(LANGUAGES) as Lang[];
usePageTitle(() => m.value.title);
</script>

<template>
  <div class="page settings-page">
    <header class="page-head">
      <div>
        <h1>{{ m.title }}</h1>
        <p v-if="auth.user">{{ auth.user.email }}</p>
      </div>
    </header>
    <div class="settings">
      <nav class="card snav" :aria-label="m.sections">
        <a href="#profile">{{ m.profile }}</a>
        <a href="#study">{{ m.study }}</a>
        <a href="#security">{{ m.security }}</a>
        <a href="#look">{{ m.look }}</a>
        <a href="#data">{{ m.data }}</a>
      </nav>

      <div class="stack">
        <section id="profile" class="card flush" aria-labelledby="profile-title">
          <div class="card-head"><h2 id="profile-title">{{ m.profile }}</h2></div>
          <div class="srow">
            <div class="txt"><b>{{ m.displayName }}</b><p>{{ m.displayNameNote }}</p></div>
            <span class="value" data-test="display-name">{{ auth.user?.displayName }}</span>
          </div>
          <div class="srow">
            <div class="txt"><b>{{ m.email }}</b></div>
            <span class="value">{{ auth.user?.email }}</span>
          </div>
          <div class="srow">
            <div class="txt"><b id="language-label">{{ m.language }}</b><p>{{ m.languageNote }}</p></div>
            <div class="seg" role="group" aria-labelledby="language-label">
              <button v-for="lang in languages" :key="lang" type="button" :lang="lang" :aria-pressed="locale.lang === lang" @click="locale.set(lang)">
                {{ LANGUAGES[lang].name }}
              </button>
            </div>
          </div>
        </section>

        <StudySettings />

        <section id="security" class="card flush" aria-labelledby="security-title" :aria-busy="sessions.status.value === 'loading'">
          <div class="card-head"><h2 id="security-title">{{ m.sessions }}</h2></div>
          <p class="srow-note t2 small">{{ m.sessionsNote }}</p>
          <p v-if="sessions.status.value === 'failed'" class="srow" role="alert">
            {{ m.sessionsFailed }} <button class="btn sm" type="button" @click="sessions.reload()">{{ common.retry }}</button>
          </p>
          <p v-else-if="sessions.status.value === 'loading'" class="srow t3">{{ common.loading }}</p>
          <div v-else class="table-wrap">
            <table class="table sessions" data-test="sessions">
              <thead>
                <tr>
                  <th scope="col">{{ m.device }}</th>
                  <th scope="col">{{ m.signedInAt }}</th>
                  <th scope="col">{{ m.expiresAt }}</th>
                  <th scope="col"><span class="sr-only">{{ m.revoke }}</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="session in sorted" :key="session.id">
                  <td class="b" :title="session.userAgent ?? undefined">
                    {{ deviceName(session) }}
                    <span v-if="session.current" class="chip ok"><Icon name="check" size="sm" />{{ m.thisDevice }}</span>
                  </td>
                  <td :data-label="m.signedInAt">{{ when(session.createdAt) }}</td>
                  <td :data-label="m.expiresAt">{{ when(session.expiresAt) }}</td>
                  <td class="r">
                    <button v-if="!session.current" class="btn sm" type="button" :aria-label="m.revokeLabel(deviceName(session))" @click="revoking = session">
                      <Icon name="lock" size="sm" />{{ m.revoke }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="look" class="card flush" aria-labelledby="look-title">
          <div class="card-head"><h2 id="look-title">{{ m.look }}</h2></div>
          <div class="srow">
            <div class="txt"><b id="theme-label">{{ m.theme }}</b><p>{{ m.themeNote }}</p></div>
            <div class="seg" role="group" aria-labelledby="theme-label">
              <button type="button" :aria-pressed="theme.theme === 'light'" @click="theme.set('light')"><Icon name="sun" size="sm" />{{ m.light }}</button>
              <button type="button" :aria-pressed="theme.theme === 'dark'" @click="theme.set('dark')"><Icon name="moon" size="sm" />{{ m.dark }}</button>
            </div>
          </div>
          <div class="srow">
            <div class="txt"><b>{{ m.groups }}</b><p>{{ m.groupsNote }}</p></div>
            <ul class="chips">
              <li v-for="group in GROUPS" :key="group.id" :class="['chip', 'c', groupClass(group.id)]">
                <span aria-hidden="true">{{ group.glyph }}</span>{{ group.short[locale.lang] }}
              </li>
            </ul>
          </div>
        </section>

        <section id="data" class="card flush danger-zone" aria-labelledby="data-title">
          <div class="card-head"><h2 id="data-title">{{ m.data }}</h2></div>
          <div class="srow">
            <div class="txt">
              <b>{{ m.exportTitle }}</b><p>{{ m.exportNote }}</p>
              <p v-if="exportFailed" class="field-error" role="alert">{{ m.exportFailed }}</p>
            </div>
            <button class="btn sm" type="button" :disabled="exporting" @click="download">
              <Icon name="download" size="sm" />{{ exporting ? m.exporting : m.export }}
            </button>
          </div>
          <div class="srow">
            <div class="txt"><b>{{ m.deleteTitle }}</b><p>{{ m.deleteNote }}</p></div>
            <button class="btn sm danger" type="button" @click="deleting = true"><Icon name="trash" size="sm" />{{ m.delete }}</button>
          </div>
        </section>

        <button class="btn sign-out" type="button" @click="signOut"><Icon name="logout" size="sm" />{{ m.signOut }}</button>
      </div>
    </div>

    <ModalDialog :open="revoking !== null" role="alertdialog" labelledby="revoke-title" describedby="revoke-body" @close="revoking = null">
      <span class="ic" aria-hidden="true"><Icon name="lock" /></span>
      <h2 id="revoke-title">{{ m.revokeTitle }}</h2>
      <p id="revoke-body" class="t2">{{ revoking && m.revokeBody(deviceName(revoking)) }}</p>
      <div class="acts">
        <button class="btn" type="button" autofocus @click="revoking = null">{{ common.cancel }}</button>
        <button class="btn danger" type="button" :disabled="revokeBusy" @click="revoke">{{ m.revoke }}</button>
      </div>
    </ModalDialog>
    <DeleteAccountDialog :open="deleting" @close="deleting = false" />
  </div>
</template>

<style>
.settings-page { max-width: 1080px; }
.settings { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 22px; align-items: start; }
.settings > .stack { grid-row: 1; grid-column: 1; }
.snav { grid-column: 2; display: grid; gap: 4px; padding: 10px; position: sticky; top: 20px; }
.snav a { padding: 9px 12px; border-radius: 10px; text-decoration: none; font-weight: 600; color: var(--ink-2); font-size: 14px; }
.snav a:hover { background: var(--surface-2); color: var(--ink); }
.settings section { scroll-margin-top: 20px; }
.srow { display: flex; justify-content: space-between; align-items: center; gap: 12px 16px; padding: 16px 22px; border-top: 1px solid var(--line); flex-wrap: wrap; }
.card-head + .srow { border-top: 0; }
.srow .txt { min-width: 0; flex: 1 1 260px; }
.srow .txt b { display: block; font-size: 14.5px; }
.srow .txt p { font-size: 13.5px; color: var(--ink-2); }
.srow .value { font-weight: 600; overflow-wrap: anywhere; min-width: 0; }
.srow-note { padding: 0 22px 8px; }
.chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.danger-zone { border-color: var(--bad); box-shadow: 4px 4px 0 var(--bad); }
.sign-out { justify-self: start; }
.sessions td .chip { margin-left: 6px; vertical-align: middle; }
@media (max-width: 960px) {
  .settings { grid-template-columns: 1fr; }
  .settings > .stack, .snav { grid-column: 1; grid-row: auto; }
  .snav { position: static; display: flex; overflow-x: auto; }
  .snav a { white-space: nowrap; }
}
@media (max-width: 620px) {
  .srow { padding: 14px 16px; }
  .srow-note { padding: 0 16px 8px; }
  /* Sessions read as one block each on a phone, each date with its label. */
  .sessions thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .sessions tr { display: grid; gap: 4px; padding: 12px 16px; border-top: 1px solid var(--line); }
  .sessions td { display: block; padding: 0; border: 0; text-align: left; }
  .sessions td[data-label]::before { content: attr(data-label) ': '; color: var(--ink-3); }
  .sessions td.r { text-align: left; margin-top: 4px; }
}
</style>
