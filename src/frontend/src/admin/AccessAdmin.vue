<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from 'vue';
import { byField } from '../api.js';
import { newestOnly, useAsyncLoad } from '../async-load.js';
import { useAuth } from '../auth/store.js';
import SelectMenu from '../components/SelectMenu.vue';
import { formatDateTime, useLocale, useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { useToast } from '../shell/toast.js';
import {
  createProgram,
  fetchAccessPrograms,
  fetchUserGrants,
  grantGlobal,
  grantProgram,
  revokeGlobal,
  revokeProgram,
} from './api.js';
import ConfirmDialog from './ConfirmDialog.vue';
import { readFailure, type Failure } from './errors.js';
import FieldErrors from './FieldErrors.vue';
import { newProgramBody, PROGRAM_FIELDS, storedCode, type ProgramValues } from './forms.js';
import { GLOBAL_PERMISSIONS, type GlobalPermission, type ProgramGrant, type UserGrants } from './grants.js';
import { ADMIN_MESSAGES } from './messages.js';
import { describeProblem } from './problem.js';
import ProblemNote from './ProblemNote.vue';
import ProgramDialog from './ProgramDialog.vue';
import { useAdminAccess } from './access.js';
import { stayWhileBusy, useAdminDialog, useWrites, type WriteOutcome } from './write.js';

const auth = useAuth();
const access = useAdminAccess();
const locale = useLocale();
const toast = useToast();
const m = useMessages(ADMIN_MESSAGES);
const text = computed(() => m.value.access);

const programs = useAsyncLoad('the programs to grant', async () => (await fetchAccessPrograms()).programs);

const typed = ref('');
const grants = shallowRef<UserGrants | null>(null);
const userId = ref('');
const status = ref<'idle' | 'loading' | 'found' | 'refused' | 'failed'>('idle');
const lookupFailure = shallowRef<Failure | null>(null);
const newest = newestOnly();

const sameId = (a: string | null | undefined, b: string | null | undefined): boolean => !!a && !!b && a.toLowerCase() === b.toLowerCase();

async function refresh(of = userId.value): Promise<UserGrants> {
  const isNewest = newest.start();
  const fresh = await fetchUserGrants(of);
  if (isNewest() && sameId(of, userId.value)) show(fresh);
  return fresh;
}

function show(saved: UserGrants): void {
  grants.value = saved;
  userId.value = saved.userId;
  status.value = 'found';
  if (sameId(saved.userId, auth.user?.id)) void access.load({ fresh: true });
}

async function find(): Promise<void> {
  const wanted = typed.value.trim();
  if (!wanted || writing.value) return;
  stale.value = false;
  notice.value = false;
  inlineWrites.clear();
  grants.value = null;
  lookupFailure.value = null;
  userId.value = wanted;
  status.value = 'loading';
  const isNewest = newest.upcoming();
  try {
    await refresh(wanted);
  } catch (e) {
    if (!isNewest()) return;
    const failure = readFailure(e);
    if (failure.kind === 'signed_out') return;
    lookupFailure.value = failure;
    if (failure.kind === 'no_answer') console.error("Loading a user's grants failed:", e);
    if (failure.kind === 'permission') void access.load({ fresh: true });
    status.value = failure.kind === 'no_answer' ? 'failed' : 'refused';
  }
}

const lookupRefusal = computed(() => {
  const failure = lookupFailure.value;
  if (status.value !== 'refused' || !failure) return null;
  if (failure.kind === 'not_found') return { code: 'not_found', text: text.value.noAccount, errors: [] as string[] };
  if (failure.kind === 'validation') return { code: 'validation_failed', text: text.value.badUserId, errors: byField(failure.details, ['userId']).fields.userId ?? failure.details };
  if (failure.kind === 'permission') return { code: 'permission_required', text: m.value.sectionDenied(m.value.permissions[failure.permission ?? 'access_manager']), errors: [] };
  return { code: 'refused', text: text.value.lookupFailed, errors: [] };
});

const own = computed(() => sameId(grants.value?.userId, auth.user?.id));
const when = (iso: string) => formatDateTime(iso, locale.lang);
const globalGrantOf = (permission: GlobalPermission) => grants.value?.permissions.find((grant) => grant.permission === permission) ?? null;
const programId = ref<string | null>(null);

const inlineWrites = useWrites();
type Revocation = { type: 'program'; grant: ProgramGrant } | { type: 'global'; permission: GlobalPermission };
const notice = ref(false);
const stale = ref(false);
stayWhileBusy(() => inlineWrites.busy.value);
const revocation = useAdminDialog<Revocation>({
  fallback: 'access-user-id',
  notice,
  stale: { reloadId: 'access-reload', is: () => stale.value, mark: () => (stale.value = true) },
});
const { dialog: revoking, writes: dialogWrites } = revocation;
const writing = computed(() => inlineWrites.busy.value || dialogWrites.busy.value);
const held = computed(() => stale.value || inlineWrites.problem.value?.outcome === 'unknown');

const holdsProgram = (saved: UserGrants, id: string) => saved.programs.some((grant) => grant.programId === id);
const holdsGlobal = (saved: UserGrants, permission: GlobalPermission) => saved.permissions.some((grant) => grant.permission === permission);

function settle(result: WriteOutcome<UserGrants>, saved: string, of: string): boolean {
  if (!sameId(of, userId.value)) {
    inlineWrites.clear();
    return false;
  }
  if (result.outcome === 'saved') {
    show(result.value);
    toast.show(saved);
    return true;
  }
  if (result.outcome === 'confirmed') notice.value = true;
  return result.outcome === 'confirmed';
}

async function giveProgram(): Promise<void> {
  const [to, id] = [grants.value?.userId, programId.value];
  if (!to || !id || inlineWrites.busy.value || held.value) return;
  notice.value = false;
  const program = programs.data.value?.find((item) => item.id === id);
  const result = await inlineWrites.send(
    () => grantProgram(to, id),
    async () => holdsProgram(await refresh(to), id),
  );
  if (settle(result, text.value.granted(text.value.programPermission(program?.code ?? id)), to)) programId.value = null;
}

async function giveGlobal(permission: GlobalPermission): Promise<void> {
  const to = grants.value?.userId;
  if (!to || inlineWrites.busy.value || held.value) return;
  notice.value = false;
  const result = await inlineWrites.send(
    () => grantGlobal(to, permission),
    async () => holdsGlobal(await refresh(to), permission),
  );
  settle(result, text.value.granted(m.value.permissions[permission]), to);
  await nextTick();
  document.getElementById(`access-action-${permission}`)?.focus();
}

function askRevoke(next: Revocation, from: Event): void {
  if (held.value) return;
  inlineWrites.clear();
  notice.value = false;
  revocation.open(next, from);
}

const closeDialog = revocation.close;

async function reloadStale(): Promise<void> {
  try {
    await refresh();
    stale.value = false;
  } catch (e) {
    if (readFailure(e).kind !== 'signed_out') console.error("Reloading a user's grants failed:", e);
  }
}

const cancel = revocation.cancel;

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
          () => revokeProgram(from, current.grant.programId),
          async () => !holdsProgram(await refresh(from), current.grant.programId),
        )
      : await dialogWrites.send(
          () => revokeGlobal(from, current.permission),
          async () => !holdsGlobal(await refresh(from), current.permission),
        );
  if (!settle(result, text.value.revoked(name), from)) return;
  await closeDialog(current.type === 'global' ? `access-action-${current.permission}` : 'access-program-select');
}

const programNotice = ref(false);
const programForm = useAdminDialog<true>({ fallback: 'program-add', notice: programNotice });
const { writes: programWrites, busy: programBusy, cancel: cancelProgram } = programForm;
const programOpen = computed(() => programForm.dialog.value !== null);

function openProgram(from: Event): void {
  notice.value = false;
  programForm.open(true, from);
}

async function programListed(values: ProgramValues): Promise<boolean> {
  const { programs: listed } = await fetchAccessPrograms();
  return listed.some((item) => item.code === storedCode(values.code) && item.nameVi === values.nameVi.trim());
}

const endProgram = (result: WriteOutcome<unknown>, code: string) => programForm.finish(result, m.value.programs.programCreated(code), { before: programs.reload });

async function saveProgram(values: ProgramValues): Promise<void> {
  programNotice.value = false;
  const result = await programWrites.send(
    () => createProgram(newProgramBody(values)),
    () => programListed(values),
  );
  await endProgram(result, result.outcome === 'saved' ? result.value.code : storedCode(values.code));
}

async function recheckProgram(): Promise<void> {
  const result = await programWrites.recheck();
  if (result?.outcome === 'confirmed') await endProgram(result, '');
}

const programProblem = computed(() => {
  if (!programWrites.problem.value) return null;
  const problem = describeProblem(programWrites.problem.value, m.value, PROGRAM_FIELDS);
  return problem.code === 'duplicate_code' ? { ...problem, text: m.value.programs.duplicateProgramCode } : problem;
});

const inlineProblem = computed(() => (inlineWrites.problem.value ? describeProblem(inlineWrites.problem.value, m.value) : null));
const dialogProblem = computed(() => (dialogWrites.problem.value ? describeProblem(dialogWrites.problem.value, m.value) : null));
async function recheckInline(): Promise<void> {
  if ((await inlineWrites.recheck())?.outcome === 'confirmed') notice.value = true;
}
async function recheckDialog(): Promise<void> {
  if ((await dialogWrites.recheck())?.outcome !== 'confirmed') return;
  await closeDialog();
  notice.value = true;
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
          <button class="btn" type="submit" :disabled="!typed.trim() || status === 'loading' || writing" data-test="access-find"><Icon name="search" size="sm" />{{ text.find }}</button>
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
        <p v-if="notice" class="callout ok" role="status" data-test="admin-notice"><Icon name="check" /><span>{{ m.problem.confirmed }}</span></p>
        <p v-if="stale" class="callout warn" role="alert" data-test="access-stale">
          <Icon name="alert" /><span>{{ m.stale }} <button id="access-reload" class="btn sm" type="button" data-test="access-reload" @click="reloadStale">{{ m.reload }}</button></span>
        </p>
        <ProblemNote :problem="inlineProblem" @reload="recheckInline" />

        <section aria-labelledby="access-programs-title">
          <h4 id="access-programs-title">{{ text.programs }}</h4>
          <p class="small t2">{{ text.describe.program_admin }}</p>
          <p v-if="grants.programs.length === 0" class="small t3" data-test="access-no-programs">{{ text.noProgramGrants }}</p>
          <div v-else class="table-wrap">
            <table class="table admin-cards access-table">
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
                  <td :data-label="text.columns.grantedAt">{{ when(grant.grantedAt) }}</td>
                  <td class="small wide granter" :class="grant.grantedBy ? 'mono' : 't3'" :data-label="text.columns.grantedBy">{{ grant.grantedBy ?? text.noGranter }}</td>
                  <td class="r acts">
                    <button class="btn sm" type="button" :disabled="held" :aria-label="text.revokeLabel(text.programPermission(grant.programCode))" data-test="access-revoke-program" @click="askRevoke({ type: 'program', grant }, $event)">
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
            <div class="field">
              <span class="label">{{ text.program }}</span>
              <SelectMenu
                id="access-program-select"
                v-model="programId"
                :aria-label="text.program"
                :options="(programs.data.value ?? []).map((item) => ({ value: item.id, label: `${item.code} · ${item.nameVi}` }))"
                :placeholder="text.pickProgram"
                data-test="access-program"
              />
            </div>
            <button class="btn" type="submit" :disabled="!programId || inlineWrites.busy.value || held" data-test="access-grant-program"><Icon name="key" size="sm" />{{ text.grantProgram }}</button>
          </form>
        </section>

        <section aria-labelledby="access-global-title">
          <h4 id="access-global-title">{{ text.global }}</h4>
          <div class="table-wrap">
            <table class="table admin-cards access-table">
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
                  <td class="wide" data-test="access-status" :data-label="text.columns.status">
                    <span v-if="globalGrantOf(permission)" class="chip ok"><Icon name="check" size="sm" />{{ text.held(when(globalGrantOf(permission)!.grantedAt)) }}</span>
                    <span v-else class="chip">{{ text.notHeld }}</span>
                  </td>
                  <td class="r acts">
                    <button
                      v-if="globalGrantOf(permission)"
                      :id="`access-action-${permission}`"
                      class="btn sm"
                      type="button"
                      :disabled="held"
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
                      :disabled="inlineWrites.busy.value || held"
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

    <section class="card flush" aria-labelledby="access-new-program-title" data-test="access-new-program">
      <div class="card-head">
        <h2 id="access-new-program-title">{{ m.programs.programsTitle }}</h2>
        <button id="program-add" class="btn sm" type="button" :disabled="programBusy" data-test="program-add" @click="openProgram"><Icon name="plus" size="sm" />{{ m.programs.addProgram }}</button>
      </div>
      <div class="admin-tools">
        <p class="small t2">{{ m.programs.programsLead }}</p>
        <p v-if="programNotice" class="callout ok" role="status" data-test="program-notice"><Icon name="check" /><span>{{ m.problem.confirmed }}</span></p>
      </div>
    </section>

    <ProgramDialog :open="programOpen" :program="null" :busy="programBusy" :problem="programProblem" @close="cancelProgram" @save="saveProgram" @reload="recheckProgram" />
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

<style scoped>
.link-form.access-lookup .field { flex: 1 1 360px; max-width: 420px; }
.access-user { border-top: 1px solid var(--edge); padding: 18px 22px 22px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; }
.access-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.access-head h3 { overflow-wrap: anywhere; }
.access-user section { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
.access-user h4 { font-size: 15px; font-weight: 650; margin: 0; }
.access-user .table-wrap { border: 1px solid var(--edge); border-radius: 12px; }
.access-table .about { display: block; font-weight: 400; max-width: 56ch; margin-top: 2px; }
.access-table .granter { overflow-wrap: anywhere; }
@media (max-width: 760px) {
  .admin-cards.access-table tr { grid-template-columns: minmax(0, 1fr); }
  .admin-cards.access-table td[data-label]::before { font-family: var(--font); }
}
.access-user .link-form .field { flex: 0 1 320px; }
.admin-section :deep(.ui-select-list) { max-width: min(420px, calc(100vw - 72px)); }
.admin-section :deep(.ui-select-list li) { white-space: normal; overflow-wrap: anywhere; }
@media (max-width: 620px) {
  .access-user { padding: 16px; }
}
</style>
