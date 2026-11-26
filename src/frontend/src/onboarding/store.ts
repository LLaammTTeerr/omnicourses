import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useAccountCache, useAuth } from '../auth/store.js';
import { fetchOnboarding, saveOnboarding, type Onboarding } from './api.js';

// The signed-in student's onboarding answers (UC-01 steps 6–9, A8, A9), shared by the router guard, the wizard, the
// settings and the explorer. The answers belong to one account: after a sign-out or another sign-in in the same tab
// they are not reused, so nothing of one student shows to the next.

export const useOnboarding = defineStore('onboarding', () => {
  const auth = useAuth();
  /** The last answers loaded or saved, with the account they belong to. Tests seed it. */
  const cache = useAccountCache(fetchOnboarding);
  const answers = cache.value;
  const finished = computed(() => answers.value?.finished ?? false);

  /** The answers, from the API the first time for each account. */
  const load = (): Promise<Onboarding> => cache.load();

  /** Replaces every answer (PUT sends the whole object) and keeps what the API saved. */
  async function save(next: Onboarding): Promise<Onboarding> {
    const userId = auth.user?.id;
    if (!userId) throw new Error('Not signed in');
    return cache.keep(userId, await saveOnboarding(next));
  }

  return { seed: cache.seed, answers, finished, load, save };
});
