import { beforeAll } from 'vitest';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createMemoryHistory, type Router } from 'vue-router';
import { user } from '../auth/testing/fixtures.js';
import { useAuth } from '../auth/store.js';
import type { Onboarding } from '../onboarding/api.js';
import { useOnboarding } from '../onboarding/store.js';
import { onboarding } from '../onboarding/testing/fixtures.js';
import { createAppRouter } from '../router.js';
import { warmRoutes } from './routes.js';

beforeAll(() => warmRoutes());

interface Options {
  signedIn?: boolean;
  onboarded?: Onboarding | null;
}

export function signedInPinia(): Pinia {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuth();
  auth.token = 'zz-token';
  auth.user = user();
  return pinia;
}

export async function setup(path: string, { signedIn = true, onboarded = onboarding() }: Options = {}): Promise<{ pinia: Pinia; router: Router }> {
  const pinia = signedIn ? signedInPinia() : createPinia();
  if (!signedIn) setActivePinia(pinia);
  if (onboarded) useOnboarding().seed(user().id, onboarded);
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  return { pinia, router };
}
