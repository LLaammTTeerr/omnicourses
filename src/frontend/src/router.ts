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
import { afterSignIn, HOME_SIGNED_IN } from './auth/redirect.js';
import { useAuth } from './auth/store.js';
import { useOnboarding } from './onboarding/store.js';
import type { MenuEntry } from './shell/nav.js';

declare module 'vue-router' {
  interface RouteMeta {
    keepAlive?: boolean;
    layout?: 'public' | 'app' | 'bare' | 'auto';
    auth?: 'required' | 'guest';
    onboarding?: 'optional';
    menu?: MenuEntry;
  }
}

const APP = { layout: 'app', auth: 'required' } as const;

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('./views/HomeView.vue'), meta: { layout: 'public' } },
  { path: '/sign-in', name: 'sign-in', component: () => import('./auth/SignInView.vue'), meta: { layout: 'bare', auth: 'guest' } },
  { path: '/sign-up', name: 'sign-up', component: () => import('./auth/SignUpView.vue'), meta: { layout: 'bare', auth: 'guest' } },
  { path: '/onboarding', name: 'onboarding', component: () => import('./onboarding/OnboardingView.vue'), meta: { layout: 'bare', auth: 'required' } },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('./audit/DashboardView.vue'),
    meta: { ...APP, menu: { icon: 'home', label: { vi: 'Tổng quan', en: 'Dashboard' }, group: 'core', section: 'main', phoneTab: 1 } },
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: () => import('./calendar/CalendarView.vue'),
    meta: { ...APP, menu: { icon: 'calendar', label: { vi: 'Lịch', en: 'Calendar' }, group: 'pol', section: 'main' } },
  },
  {
    path: '/notifications',
    name: 'notifications',
    component: () => import('./notifications/NotificationsView.vue'),
    meta: {
      ...APP,
      menu: { icon: 'bell', label: { vi: 'Thông báo', en: 'Notifications' }, group: 'pol', section: 'main', unreadBadge: true },
    },
  },
  {
    path: '/audit',
    name: 'audit',
    component: () => import('./audit/AuditView.vue'),
    meta: {
      ...APP,
      menu: {
        icon: 'audit',
        label: { vi: 'Xét tốt nghiệp', en: 'Degree audit' },
        tab: { vi: 'Tốt nghiệp', en: 'Audit' },
        group: 'gen',
        section: 'main',
        phoneTab: 3,
      },
    },
  },
  {
    path: '/transcript',
    name: 'transcript',
    component: () => import('./transcript/TranscriptView.vue'),
    meta: { ...APP, menu: { icon: 'file', label: { vi: 'Bảng điểm', en: 'Transcript' }, group: 'gen', section: 'main' } },
  },
  {
    path: '/explorer',
    name: 'explorer',
    component: () => import('./explorer/ExplorerView.vue'),
    meta: { ...APP, menu: { icon: 'graph', label: { vi: 'Chương trình', en: 'Curriculum' }, group: 'phys', section: 'main', phoneTab: 4 } },
  },
  {
    path: '/plans',
    meta: APP,
    children: [
      {
        path: '',
        name: 'plans',
        component: () => import('./plans/PlannerEntry.vue'),
        meta: { menu: { icon: 'columns', label: { vi: 'Lộ trình', en: 'Plans' }, group: 'elec', section: 'main', phoneTab: 2 } },
      },
      { path: 'all', name: 'plan-list', component: () => import('./plans/PlansView.vue') },
      { path: ':id', name: 'plan', component: () => import('./plans/PlanEditorView.vue'), props: true },
    ],
  },
  {
    path: '/guides',
    name: 'guides',
    component: () => import('./guides/GuidesView.vue'),
    meta: {
      layout: 'auto',
      keepAlive: true,
      menu: { icon: 'book', label: { vi: 'Hướng dẫn', en: 'Guides' }, group: 'math', section: 'main', visitors: true },
    },
  },
  { path: '/guides/:id', name: 'guide', component: () => import('./guides/GuideView.vue'), props: true, meta: { layout: 'auto' } },
  { path: '/shared/:token', name: 'shared-plan', component: () => import('./sharing/SharedPlanView.vue'), props: true, meta: { layout: 'auto' } },
  { path: '/privacy', name: 'privacy', component: () => import('./privacy/PrivacyView.vue'), meta: { layout: 'auto' } },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('./account/SettingsView.vue'),
    meta: {
      ...APP,
      onboarding: 'optional',
      menu: { icon: 'sliders', label: { vi: 'Cài đặt', en: 'Settings' }, group: 'thesis', section: 'account' },
    },
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('./admin/AdminView.vue'),
    meta: {
      ...APP,
      onboarding: 'optional',
      menu: { icon: 'db', label: { vi: 'Quản trị', en: 'Administration' }, group: 'thesis', section: 'account', grant: true },
    },
    children: [
      { path: 'curriculum', name: 'admin-curriculum', component: () => import('./admin/CurriculumAdmin.vue') },
      { path: 'calendar', name: 'admin-calendar', component: () => import('./admin/CalendarAdmin.vue') },
      { path: 'catalog', name: 'admin-catalog', component: () => import('./admin/CatalogAdmin.vue') },
      { path: 'import', name: 'admin-import', component: () => import('./admin/ImportAdmin.vue') },
      { path: 'access', name: 'admin-access', component: () => import('./admin/AccessAdmin.vue') },
    ],
  },
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
