<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from 'vue';
import { useAsyncLoad } from '../async-load.js';
import { useAuth } from '../auth/store.js';
import SelectMenu from '../components/SelectMenu.vue';
import { formatDateTime, useLocale, useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { useToast } from '../shell/toast.js';
import {
  fetchAccessPrograms,
  fetchUserGrants,
  GLOBAL_PERMISSIONS,
  grantGlobal,
  grantProgram,
  revokeGlobal,
  revokeProgram,
  type GlobalPermission,
  type ProgramGrant,
  type UserGrants,
} from './api.js';
import ConfirmDialog from './ConfirmDialog.vue';
import { byField, readFailure, type Failure } from './errors.js';
import FieldErrors from './FieldErrors.vue';
import { ADMIN_MESSAGES } from './messages.js';
import { describeProblem } from './problem.js';
import ProblemNote from './ProblemNote.vue';
import { useAdminAccess } from './store.js';
import { useWrites, type WriteOutcome } from './write.js';

// Grants and revocations of an access manager (ADR 0011, UC-11 A2, section 8). A user is found by their exact user
// ID, which they copy from Settings: the API has no user directory and no search. The answer holds grants only,
// never a name or an email. The API decides everything: it refuses a recipient waiting for deletion and the
// revocation of the last active access manager, and this page says so in words.
const auth = useAuth();
const access = useAdminAccess();
const locale = useLocale();
const toast = useToast();
const m = useMessages(ADMIN_MESSAGES);
const text = computed(() => m.value.access);

const programs = useAsyncLoad('the programs to grant', async () => (await auth.authed(fetchAccessPrograms)).programs);

// ---------- The user on screen, by their ID ----------
const typed = ref('');
const grants = shallowRef<UserGrants | null>(null);
/** The ID last looked up, as typed without the spaces around it. */
const userId = ref('');
const status = ref<'idle' | 'loading' | 'found' | 'refused' | 'failed'>('idle');
const lookupFailure = shallowRef<Failure | null>(null);
let latest = 0;

/** Reads the user's saved grants again and shows them. Rejects when the API cannot say. */
async function refresh(of = userId.value): Promise<UserGrants> {
  const call = ++latest;
  const fresh = await auth.authed((token) => fetchUserGrants(token, of));
  if (call === latest) show(fresh);
  return fresh;
}

function show(saved: UserGrants): void {
  grants.value = saved;
  userId.value = saved.userId;
  status.value = 'found';
  // The access manager's own grants decide which sections this page offers them.
  if (saved.userId === auth.user?.id) void access.load({ fresh: true });
}

async function find(): Promise<void> {
  const wanted = typed.value.trim();
  if (!wanted) return;
  notice.value = null;
  inlineWrites.clear();
  grants.value = null;
  lookupFailure.value = null;
  userId.value = wanted;
  status.value = 'loading';
  const call = latest + 1;
  try {
    await refresh(wanted);
  } catch (e) {
    if (call !== latest) return;
    const failure = readFailure(e);
    if (failure.kind === 'signed_out') return;
    lookupFailure.value = failure;
    if (failure.kind === 'no_answer') console.error("Loading a user's grants failed:", e);
    if (failure.kind === 'permission') void access.load({ fresh: true });
    status.value = failure.kind === 'no_answer' ? 'failed' : 'refused';
  }
}

/** Why the API refused the lookup, in words. A malformed ID is the API's call; its message shows under the box. */
const lookupRefusal = computed(() => {
  const failure = lookupFailure.value;
  if (status.value !== 'refused' || !failure) return null;
  if (failure.kind === 'not_found') return { code: 'not_found', text: text.value.noAccount, errors: [] as string[] };
  if (failure.kind === 'validation') return { code: 'validation_failed', text: text.value.badUserId, errors: byField(failure.details, ['userId']).fields.userId ?? failure.details };
  if (failure.kind === 'permission') return { code: 'permission_required', text: m.value.sectionDenied(m.value.permissions[failure.permission ?? 'access_manager']), errors: [] };
  return { code: 'refused', text: text.value.lookupFailed, errors: [] };
});

const own = computed(() => grants.value?.userId === auth.user?.id);
const when = (iso: string) => formatDateTime(iso, locale.lang);
const globalGrantOf = (permission: GlobalPermission) => grants.value?.permissions.find((grant) => grant.permission === permission) ?? null;
const programId = ref<string | null>(null);

// ---------- Writes ----------
/** Grants are sent from the page; a revocation asks first, in a dialog. */
const inlineWrites = useWrites();
const dialogWrites = useWrites();
type Revocation = { type: 'program'; grant: ProgramGrant } | { type: 'global'; permission: GlobalPermission };
const revoking = shallowRef<Revocation | null>(null);
const notice = ref<string | null>(null);
let opener: HTMLElement | null = null;

const holdsProgram = (saved: UserGrants, id: string) => saved.programs.some((grant) => grant.programId === id);
const holdsGlobal = (saved: UserGrants, permission: GlobalPermission) => saved.permissions.some((grant) => grant.permission === permission);

/** Shows what a grant or a revocation left saved. Resolves true when it is saved. */
function settle(result: WriteOutcome<UserGrants>, saved: string): boolean {
  if (result.outcome === 'saved') {
    show(result.value);
    toast.show(saved);
    return true;
  }
  if (result.outcome === 'confirmed') notice.value = m.value.problem.confirmed;
  return result.outcome === 'confirmed';
}

async function giveProgram(): Promise<void> {
  const [to, id] = [grants.value?.userId, programId.value];
  if (!to || !id || inlineWrites.busy.value) return;
  notice.value = null;
  const program = programs.data.value?.find((item) => item.id === id);
  const result = await inlineWrites.send(
    (token) => grantProgram(token, to, id),
    async () => holdsProgram(await refresh(to), id),
  );
  if (settle(result, text.value.granted(text.value.programPermission(program?.code ?? id)))) programId.value = null;
}

async function giveGlobal(permission: GlobalPermission): Promise<void> {
  const to = grants.value?.userId;
  if (!to || inlineWrites.busy.value) return;
  notice.value = null;
  const result = await inlineWrites.send(
    (token) => grantGlobal(token, to, permission),
    async () => holdsGlobal(await refresh(to), permission),
  );
  settle(result, text.value.granted(m.value.permissions[permission]));
  // The Grant button became a Revoke button: keep the focus on the control of the same permission.
  await nextTick();
  document.getElementById(`access-action-${permission}`)?.focus();
}

function askRevoke(next: Revocation, from: Event): void {
  opener = from.currentTarget instanceof HTMLElement ? from.currentTarget : null;
  dialogWrites.clear();
  inlineWrites.clear();
  notice.value = null;
  revoking.value = next;
}

/** Closes the dialog and puts the focus back where it was, or on `fallback` when that control is gone. */
async function closeDialog(fallback = 'access-user-id'): Promise<void> {
  revoking.value = null;
  dialogWrites.clear();
  await nextTick();
  (opener?.isConnected ? opener : document.getElementById(fallback))?.focus();
  opener = null;
}

/** Cancel (UC-11 A6): nothing is revoked and nothing is sent. */
function cancel(): void {
  if (!dialogWrites.busy.value) void closeDialog();
}

const revokingName = computed(() => {
  const current = revoking.value;
  if (!current) return '';
  return current.type === 'program' ? text.value.programPermission(current.grant.programCode) : m.value.permissions[current.permission];
});

async function revoke(): Promise<void> {
  const [from, current, name] = [grants.value?.userId, revoking.value, revokingName.value];
  if (!from || !current) return;
  const result =
    current.type === 'program'
      ? await dialogWrites.send(
          (token) => revokeProgram(token, from, current.grant.programId),
          async () => !holdsProgram(await refresh(from), current.grant.programId),
        )
      : await dialogWrites.send(
          (token) => revokeGlobal(token, from, current.permission),
          async () => !holdsGlobal(await refresh(from), current.permission),
        );
  if (!settle(result, text.value.revoked(name))) return;
  // The Revoke button is gone with the grant: the focus goes to the control that can grant it again.
  await closeDialog(current.type === 'global' ? `access-action-${current.permission}` : 'access-program-select');
}

const inlineProblem = computed(() => (inlineWrites.problem.value ? describeProblem(inlineWrites.problem.value, m.value) : null));
const dialogProblem = computed(() => (dialogWrites.problem.value ? describeProblem(dialogWrites.problem.value, m.value) : null));
/**
 * "Reload the data" after an unknown outcome (UC-11 A7): reads the user's grants again and says what they show of
 * the same grant or revocation, which is not sent again.
 */
async function recheckInline(): Promise<void> {
  if ((await inlineWrites.recheck())?.outcome === 'confirmed') notice.value = m.value.problem.confirmed;
}
async function recheckDialog(): Promise<void> {
  if ((await dialogWrites.recheck())?.outcome !== 'confirmed') return;
  await closeDialog();
  notice.value = m.value.problem.confirmed;
}
</script>

<template>
  <section class="admin-section" aria-labelledby="access-admin-title">
    <div class="card flush">
      <div class="card-head">
        <h2 id="access-admin-title">{{ text.heading }}</h2>
        <span class="meta">{{ text.lead }}</span>
      </div>
      <div class="admin-tools">
        <form class="link-form access-lookup" novalidate @submit.prevent="find">
          <div class="field">
            <label for="access-user-id">{{ text.userId }}</label>
            <input
              id="access-user-id"
              v-model="typed"
              class="input mono"
              autocomplete="off"
              spellcheck="false"
              data-test="access-user-id"
              :aria-invalid="lookupRefusal?.errors.length ? 'true' : undefined"
              :aria-describedby="lookupRefusal?.errors.length ? 'access-hint access-user-id-error' : 'access-hint'"
            />
          </div>
          <button class="btn" type="submit" :disabled="!typed.trim() || status === 'loading'" data-test="access-find"><Icon name="search" size="sm" />{{ text.find }}</button>
        </form>
        <p id="access-hint" class="hint">{{ text.hint }}</p>
        <FieldErrors id="access-user-id-error" :errors="lookupRefusal?.errors" />

        <p v-if="status === 'loading'" class="t3" role="status">{{ m.loading }}</p>
        <p v-else-if="status === 'failed'" class="callout bad" role="alert" data-test="access-failed">
          <Icon name="alert" /><span>{{ text.lookupFailed }} <button class="btn sm" type="button" @click="find">{{ m.retry }}</button></span>
        </p>
        <p v-else-if="lookupRefusal" class="callout" :class="{ bad: lookupRefusal.code !== 'not_found' }" role="alert" data-test="access-refused" :data-code="lookupRefusal.code">
          <Icon :name="lookupRefusal.code === 'not_found' ? 'info' : 'alert'" /><span>{{ lookupRefusal.text }}</span>
        </p>
      </div>

      <div v-if="grants" class="access-user" data-test="access-user" :data-user-id="grants.userId">
        <div class="access-head">
          <h3>{{ text.grantsOf }} <span class="mono" data-test="access-shown-id">{{ grants.userId }}</span></h3>
          <span v-if="own" class="chip info" data-test="access-own">{{ text.ownAccount }}</span>
        </div>
        <p v-if="notice" class="callout ok" role="status" data-test="admin-notice"><Icon name="check" /><span>{{ notice }}</span></p>
        <ProblemNote :problem="inlineProblem" @reload="recheckInline" />

        <section aria-labelledby="access-programs-title">
          <h4 id="access-programs-title">{{ text.programs }}</h4>
          <p class="small t2">{{ text.describe.program_admin }}</p>
          <p v-if="grants.programs.length === 0" class="small t3" data-test="access-no-programs">{{ text.noProgramGrants }}</p>
          <div v-else class="table-wrap">
            <table class="table access-table">
              <thead>
                <tr>
                  <th scope="col">{{ text.columns.program }}</th>
                  <th scope="col">{{ text.columns.grantedAt }}</th>
                  <th scope="col">{{ text.columns.grantedBy }}</th>
                  <th scope="col"><span class="sr-only">{{ text.columns.actions }}</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="grant in grants.programs" :key="grant.programId" data-test="access-program-grant" :data-program="grant.programCode">
                  <th scope="row"><span class="code">{{ grant.programCode }}</span></th>
                  <td>{{ when(grant.grantedAt) }}</td>
                  <td class="small" :class="grant.grantedBy ? 'mono' : 't3'">{{ grant.grantedBy ?? text.noGranter }}</td>
                  <td class="r">
                    <button class="btn sm" type="button" :aria-label="text.revokeLabel(text.programPermission(grant.programCode))" data-test="access-revoke-program" @click="askRevoke({ type: 'program', grant }, $event)">
                      <Icon name="lock" size="sm" />{{ text.revoke }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="programs.status.value === 'failed'" class="callout bad small" role="alert" data-test="access-programs-failed">
            <Icon name="alert" size="sm" /><span>{{ text.programsFailed }} <button class="btn sm" type="button" @click="programs.reload">{{ m.retry }}</button></span>
          </p>
          <form v-else class="link-form" novalidate @submit.prevent="giveProgram">
            <label class="field">
              <span>{{ text.program }}</span>
              <SelectMenu
                id="access-program-select"
                v-model="programId"
                :options="(programs.data.value ?? []).map((item) => ({ value: item.id, label: `${item.code} · ${item.nameVi}` }))"
                :placeholder="text.pickProgram"
                data-test="access-program"
              />
            </label>
            <button class="btn" type="submit" :disabled="!programId || inlineWrites.busy.value" data-test="access-grant-program"><Icon name="key" size="sm" />{{ text.grantProgram }}</button>
          </form>
        </section>

        <section aria-labelledby="access-global-title">
          <h4 id="access-global-title">{{ text.global }}</h4>
          <div class="table-wrap">
            <table class="table access-table">
              <thead>
                <tr>
                  <th scope="col">{{ text.columns.permission }}</th>
                  <th scope="col">{{ text.columns.status }}</th>
                  <th scope="col"><span class="sr-only">{{ text.columns.actions }}</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="permission in GLOBAL_PERMISSIONS" :key="permission" :data-test="`access-global-${permission}`" :data-state="globalGrantOf(permission) ? 'held' : 'not-held'">
                  <th scope="row">{{ m.permissions[permission] }}<span class="small t2 about">{{ text.describe[permission] }}</span></th>
                  <!-- Held or not, in words: the chip's colour is never the only cue. -->
                  <td data-test="access-status">
                    <span v-if="globalGrantOf(permission)" class="chip ok"><Icon name="check" size="sm" />{{ text.held(when(globalGrantOf(permission)!.grantedAt)) }}</span>
                    <span v-else class="chip">{{ text.notHeld }}</span>
                  </td>
                  <td class="r">
                    <button
                      v-if="globalGrantOf(permission)"
                      :id="`access-action-${permission}`"
                      class="btn sm"
                      type="button"
                      :aria-label="text.revokeLabel(m.permissions[permission])"
                      :data-test="`access-revoke-${permission}`"
                      @click="askRevoke({ type: 'global', permission }, $event)"
                    >
                      <Icon name="lock" size="sm" />{{ text.revoke }}
                    </button>
                    <button
                      v-else
                      :id="`access-action-${permission}`"
                      class="btn sm"
                      type="button"
                      :disabled="inlineWrites.busy.value"
                      :aria-label="text.grantLabel(m.permissions[permission])"
                      :data-test="`access-grant-${permission}`"
                      @click="giveGlobal(permission)"
                    >
                      <Icon name="key" size="sm" />{{ text.grant }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>

    <ConfirmDialog
      :open="revoking !== null"
      :title="text.revokeTitle"
      :body="own ? `${text.revokeBody(revokingName)} ${text.revokeOwn}` : text.revokeBody(revokingName)"
      :confirm="text.revoke"
      :busy="dialogWrites.busy.value"
      :problem="dialogProblem"
      @close="cancel"
      @confirm="revoke"
      @reload="recheckDialog"
    />
  </section>
</template>

<style>
.link-form.access-lookup .field { flex: 1 1 360px; max-width: 420px; }
.access-user { border-top: 1px solid var(--edge); padding: 18px 22px 22px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; }
.access-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.access-head h3 { overflow-wrap: anywhere; }
.access-user section { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
.access-user h4 { font-size: 15px; font-weight: 650; margin: 0; }
.access-user .table-wrap { border: 1px solid var(--edge); border-radius: 12px; }
.access-table .about { display: block; font-weight: 400; max-width: 56ch; margin-top: 2px; }
.access-user .link-form .field { flex: 0 1 320px; }
@media (max-width: 620px) {
  .access-user { padding: 16px; }
}
</style>
