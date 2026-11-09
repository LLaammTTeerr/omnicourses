import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createMemoryHistory, type Router } from 'vue-router';
import { user } from '../auth/testing/fixtures.js';
import { useAuth } from '../auth/store.js';
import type { Onboarding } from '../onboarding/api.js';
import { useOnboarding } from '../onboarding/store.js';
import { onboarding } from '../onboarding/testing/fixtures.js';
import { createAppRouter } from '../router.js';

interface Options {
  /** The synthetic student is signed in. Default true. */
  signedIn?: boolean;
  /**
   * The synthetic student's onboarding answers, as if already loaded; finished by default, so a page opens without
   * a detour to onboarding. `null` leaves them to the API, for specs of the onboarding detour itself.
   */
  onboarded?: Onboarding | null;
}

/** A fresh Pinia and an in-memory router at `path`, with the synthetic student signed in unless `signedIn` is false. */
export async function setup(path: string, { signedIn = true, onboarded = onboarding() }: Options = {}): Promise<{ pinia: Pinia; router: Router }> {
  const pinia = createPinia();
  setActivePinia(pinia);
  if (signedIn) {
    const auth = useAuth();
    auth.token = 'zz-token';
    auth.user = user();
  }
  // Seeded for the fixture's account even when signed out, so a sign-in in the spec finds it.
  if (onboarded) useOnboarding().cache = { userId: user().id, answers: onboarded };
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  return { pinia, router };
}
