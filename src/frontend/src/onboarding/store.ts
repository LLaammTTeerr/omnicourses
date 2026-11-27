import { defineStore } from 'pinia';
import { computed, watch } from 'vue';
import { useAccountCache, useAuth } from '../auth/store.js';
import { fetchOnboarding, saveOnboarding, type Onboarding } from './api.js';

export const useOnboarding = defineStore('onboarding', () => {
  const auth = useAuth();
  const cache = useAccountCache(fetchOnboarding);
  const answers = cache.value;
  const finished = computed(() => answers.value?.finished ?? false);

  watch(
    () => auth.user?.id,
    () => cache.forget(),
    { flush: 'sync' },
  );

  const load = (options?: { fresh?: boolean }): Promise<Onboarding> => cache.load(options);

  async function save(next: Onboarding): Promise<Onboarding> {
    const userId = auth.user?.id;
    if (!userId) throw new Error('Not signed in');
    return cache.keep(userId, await saveOnboarding(next));
  }

  return { seed: cache.seed, answers, finished, load, save };
});
