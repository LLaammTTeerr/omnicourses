import { computed, ref, shallowRef, watch } from 'vue';
import { newestOnly } from '../async-load.js';
import { useAdminAccess } from './access.js';
import { fetchAdminPrograms, type AdminProgram } from './api.js';
import { readFailure } from './errors.js';

interface ProgramPick {
  programId: string | null;
  curriculumId: string | null;
}

export function useProgramPicker(what: string, initial: ProgramPick | null = null) {
  const programList = shallowRef<AdminProgram[] | null>(null);
  const programsStatus = ref<'idle' | 'loading' | 'loaded' | 'failed'>('idle');
  const newest = newestOnly();

  async function loadPrograms(quiet = false): Promise<void> {
    const isNewest = newest.start();
    if (!quiet) {
      programList.value = null;
      programsStatus.value = 'loading';
    }
    try {
      const { programs } = await fetchAdminPrograms();
      if (!isNewest()) return;
      programList.value = programs;
      programsStatus.value = 'loaded';
    } catch (e) {
      if (!isNewest() || readFailure(e).kind === 'signed_out') return;
      console.error(`Loading ${what} failed:`, e);
      if (!quiet) programsStatus.value = 'failed';
    }
  }

  const picked = ref<ProgramPick | null>(initial);
  const access = useAdminAccess();
  const grantedIds = computed(() => (access.grants?.programs ?? []).map((grant) => grant.programId).sort().join());
  const listedIds = computed(() => (programList.value ?? []).map((item) => item.id).sort().join());
  watch([grantedIds, () => access.refusal], () => {
    if (!access.refusal && access.grants && programsStatus.value === 'loaded' && grantedIds.value !== listedIds.value) void loadPrograms(true);
  });

  const program = computed(() => {
    const list = programList.value ?? [];
    return list.find((item) => item.id === picked.value?.programId) ?? list[0] ?? null;
  });
  const cohort = computed(() => program.value?.curricula.find((item) => item.id === picked.value?.curriculumId) ?? program.value?.curricula[0] ?? null);
  return { programList, programsStatus, loadPrograms, picked, program, cohort };
}
