import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createMemoryHistory, type Router } from 'vue-router';
import { user } from '../auth/testing/fixtures.js';
import { useAuth } from '../auth/store.js';
import { createAppRouter } from '../router.js';

/** A fresh Pinia and an in-memory router at `path`, with the synthetic student signed in unless `signedIn` is false. */
export async function setup(path: string, { signedIn = true } = {}): Promise<{ pinia: Pinia; router: Router }> {
  const pinia = createPinia();
  setActivePinia(pinia);
  if (signedIn) {
    const auth = useAuth();
    auth.token = 'zz-token';
    auth.user = user();
  }
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  return { pinia, router };
}
