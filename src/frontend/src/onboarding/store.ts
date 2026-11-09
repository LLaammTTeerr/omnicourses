import { defineStore } from 'pinia';
import { computed, shallowRef } from 'vue';
import { useAuth } from '../auth/store.js';
import { fetchOnboarding, saveOnboarding, type Onboarding } from './api.js';

// The signed-in student's onboarding answers (UC-01 steps 6–9, A8, A9), shared by the router guard, the wizard, the
// settings and the explorer. The answers belong to one account: after a sign-out or another sign-in in the same tab
// they are not reused, so nothing of one student shows to the next.

interface Owned {
  userId: string;
  answers: Onboarding;
}

export const useOnboarding = defineStore('onboarding', () => {
  const auth = useAuth();
  /** The last answers loaded or saved, with the account they belong to. Tests seed it. */
  const cache = shallowRef<Owned | null>(null);
  let pending: { userId: string; load: Promise<Onboarding> } | null = null;

  const answers = computed(() => (cache.value && cache.value.userId === auth.user?.id ? cache.value.answers : null));
  const finished = computed(() => answers.value?.finished ?? false);

  function keep(userId: string, saved: Onboarding): Onboarding {
    if (auth.user?.id === userId) cache.value = { userId, answers: saved };
    return saved;
  }

  /** The answers, from the API the first time for each account. */
  function load(): Promise<Onboarding> {
    const userId = auth.user?.id;
    if (!userId) return Promise.reject(new Error('Not signed in'));
    if (answers.value) return Promise.resolve(answers.value);
    if (pending?.userId !== userId) {
      const load = auth.authed(fetchOnboarding).then((loaded) => keep(userId, loaded));
      pending = { userId, load };
      load.then(
        () => (pending = null),
        () => (pending = null),
      );
    }
    return pending.load;
  }

  /** Replaces every answer (PUT sends the whole object) and keeps what the API saved. */
  async function save(next: Onboarding): Promise<Onboarding> {
    const userId = auth.user?.id;
    if (!userId) throw new Error('Not signed in');
    return keep(userId, await auth.authed((token) => saveOnboarding(token, next)));
  }

  return { cache, answers, finished, load, save };
});
