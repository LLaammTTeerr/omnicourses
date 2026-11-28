import { getActivePinia } from 'pinia';
import {
  createRouter,
  createWebHistory,
  type NavigationGuardReturn,
  type RouteLocationNormalized,
  type RouteRecordRaw,
  type Router,
  type RouterHistory,
  type RouterScrollBehavior,
} from 'vue-router';
import { accountRoutes } from './account/routes.js';
import { adminRoutes } from './admin/routes.js';
import { auditRoutes, dashboardRoutes } from './audit/routes.js';
import { afterSignIn, HOME_SIGNED_IN } from './auth/redirect.js';
import { authRoutes } from './auth/routes.js';
import { useAuth } from './auth/store.js';
import { calendarRoutes } from './calendar/routes.js';
import { explorerRoutes } from './explorer/routes.js';
import { guideRoutes } from './guides/routes.js';
import { notificationRoutes } from './notifications/routes.js';
import { onboardingRoutes } from './onboarding/routes.js';
import { useOnboarding } from './onboarding/store.js';
import { planRoutes } from './plans/routes.js';
import { privacyRoutes } from './privacy/routes.js';
import { sharingRoutes } from './sharing/routes.js';
import { transcriptRoutes } from './transcript/routes.js';
import { homeRoutes } from './views/routes.js';

export const routes: RouteRecordRaw[] = [
  ...homeRoutes,
  ...authRoutes,
  ...onboardingRoutes,
  ...dashboardRoutes,
  ...calendarRoutes,
  ...notificationRoutes,
  ...auditRoutes,
  ...transcriptRoutes,
  ...explorerRoutes,
  ...planRoutes,
  ...guideRoutes,
  ...sharingRoutes,
  ...privacyRoutes,
  ...accountRoutes,
  ...adminRoutes,
  { path: '/:unknown(.*)*', redirect: '/' },
];

const scrollBehavior: RouterScrollBehavior = (to, _from, saved) => saved ?? (to.hash ? { el: to.hash } : { top: 0 });

async function onboardingFirst(to: RouteLocationNormalized): Promise<NavigationGuardReturn> {
  let finished: boolean;
  try {
    ({ finished } = await useOnboarding().load());
  } catch (e) {
    console.error('Loading the onboarding answers failed:', e);
    return true;
  }
  if (to.name === 'onboarding') {
    if (!finished) return true;
    const next = afterSignIn(to.query.redirect);
    return next.startsWith('/onboarding') ? HOME_SIGNED_IN : next;
  }
  return finished ? true : { name: 'onboarding', query: { redirect: to.fullPath } };
}

export const CHUNK_RELOAD_KEY = 'omnicourse.chunk-reload';

const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_ERROR_PATTERN.test(error.message);
}

export function reloadOnStaleChunk(targetPath: string, reload: (url: string) => void = (url) => window.location.assign(url)): boolean {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === targetPath) {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return false;
    }
    sessionStorage.setItem(CHUNK_RELOAD_KEY, targetPath);
  } catch {
    return false;
  }
  reload(targetPath);
  return true;
}

export function createAppRouter(
  history: RouterHistory = createWebHistory(),
  onChunkReload?: (url: string) => void,
): Router {
  const router = createRouter({ history, routes, scrollBehavior });
  router.beforeEach(async (to) => {
    const auth = getActivePinia() ? useAuth() : null;
    await auth?.start();
    const signedIn = auth?.signedIn ?? false;
    if (to.meta.auth === 'required' && !signedIn) return { name: 'sign-in', query: { redirect: to.fullPath } };
    if (to.meta.auth === 'guest' && signedIn) return afterSignIn(to.query.redirect);
    if (signedIn && to.meta.auth === 'required' && to.meta.onboarding !== 'optional') return onboardingFirst(to);
    return true;
  });
  router.afterEach((to) => {
    try {
      if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === to.fullPath) {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      }
    } catch {}
  });
  router.onError((error, to) => {
    if (isChunkLoadError(error)) {
      reloadOnStaleChunk(to.fullPath, onChunkReload);
    }
  });
  return router;
}
