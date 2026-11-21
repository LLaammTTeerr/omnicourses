import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createMemoryHistory, type Router } from 'vue-router';
import { user } from '../auth/testing/fixtures.js';
import type { Onboarding } from '../onboarding/api.js';
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
  // Seeded as Pinia hydrates a store, before the store exists, so no spec writes a store's state through its
  // interface. The answers are seeded for the fixture's account even when signed out, so a sign-in in the spec
  // finds them.
  if (signedIn) pinia.state.value.auth = { token: 'zz-token', user: user(), accountRestored: false };
  if (onboarded) pinia.state.value.onboarding = { cache: { userId: user().id, answers: onboarded } };
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  return { pinia, router };
}
