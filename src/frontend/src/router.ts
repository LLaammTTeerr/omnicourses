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
import SettingsView from './account/SettingsView.vue';
import AccessAdmin from './admin/AccessAdmin.vue';
import AdminView from './admin/AdminView.vue';
import CatalogAdmin from './admin/CatalogAdmin.vue';
import CurriculumAdmin from './admin/CurriculumAdmin.vue';
import ImportAdmin from './admin/ImportAdmin.vue';
import AuditView from './audit/AuditView.vue';
import DashboardView from './audit/DashboardView.vue';
import { afterSignIn, HOME_SIGNED_IN } from './auth/redirect.js';
import SignInView from './auth/SignInView.vue';
import SignUpView from './auth/SignUpView.vue';
import { useAuth } from './auth/store.js';
import CalendarView from './calendar/CalendarView.vue';
import ExplorerView from './explorer/ExplorerView.vue';
import GuideView from './guides/GuideView.vue';
import GuidesView from './guides/GuidesView.vue';
import NotificationsView from './notifications/NotificationsView.vue';
import OnboardingView from './onboarding/OnboardingView.vue';
import PlanEditorView from './plans/PlanEditorView.vue';
import PlannerEntry from './plans/PlannerEntry.vue';
import PlansView from './plans/PlansView.vue';
import PrivacyView from './privacy/PrivacyView.vue';
import type { MenuEntry } from './shell/nav.js';
import { useOnboarding } from './onboarding/store.js';
import TranscriptView from './transcript/TranscriptView.vue';
import HomeView from './views/HomeView.vue';

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
  { path: '/', name: 'home', component: HomeView, meta: { layout: 'public' } },
  { path: '/sign-in', name: 'sign-in', component: SignInView, meta: { layout: 'bare', auth: 'guest' } },
  { path: '/sign-up', name: 'sign-up', component: SignUpView, meta: { layout: 'bare', auth: 'guest' } },
  { path: '/onboarding', name: 'onboarding', component: OnboardingView, meta: { layout: 'bare', auth: 'required' } },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardView,
    meta: { ...APP, menu: { icon: 'home', label: { vi: 'Tổng quan', en: 'Dashboard' }, group: 'core', section: 'main', phoneTab: 1 } },
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: CalendarView,
    meta: { ...APP, menu: { icon: 'calendar', label: { vi: 'Lịch', en: 'Calendar' }, group: 'pol', section: 'main' } },
  },
  {
    path: '/notifications',
    name: 'notifications',
    component: NotificationsView,
    meta: {
      ...APP,
      menu: { icon: 'bell', label: { vi: 'Thông báo', en: 'Notifications' }, group: 'pol', section: 'main', unreadBadge: true },
    },
  },
  {
    path: '/audit',
    name: 'audit',
    component: AuditView,
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
    component: TranscriptView,
    meta: { ...APP, menu: { icon: 'file', label: { vi: 'Bảng điểm', en: 'Transcript' }, group: 'gen', section: 'main' } },
  },
  {
    path: '/explorer',
    name: 'explorer',
    component: ExplorerView,
    meta: { ...APP, menu: { icon: 'graph', label: { vi: 'Chương trình', en: 'Curriculum' }, group: 'phys', section: 'main', phoneTab: 4 } },
  },
  {
    path: '/plans',
    meta: APP,
    children: [
      {
        path: '',
        name: 'plans',
        component: PlannerEntry,
        meta: { menu: { icon: 'columns', label: { vi: 'Lộ trình', en: 'Plans' }, group: 'elec', section: 'main', phoneTab: 2 } },
      },
      { path: 'all', name: 'plan-list', component: PlansView },
      { path: ':id', name: 'plan', component: PlanEditorView, props: true },
    ],
  },
  {
    path: '/guides',
    name: 'guides',
    component: GuidesView,
    meta: {
      layout: 'auto',
      keepAlive: true,
      menu: { icon: 'book', label: { vi: 'Hướng dẫn', en: 'Guides' }, group: 'math', section: 'main', visitors: true },
    },
  },
  { path: '/guides/:id', name: 'guide', component: GuideView, props: true, meta: { layout: 'auto' } },
  { path: '/privacy', name: 'privacy', component: PrivacyView, meta: { layout: 'auto' } },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsView,
    meta: {
      ...APP,
      onboarding: 'optional',
      menu: { icon: 'sliders', label: { vi: 'Cài đặt', en: 'Settings' }, group: 'thesis', section: 'account' },
    },
  },
  {
    path: '/admin',
    name: 'admin',
    component: AdminView,
    meta: {
      ...APP,
      onboarding: 'optional',
      menu: { icon: 'db', label: { vi: 'Quản trị', en: 'Administration' }, group: 'thesis', section: 'account', grant: true },
    },
    children: [
      { path: 'curriculum', name: 'admin-curriculum', component: CurriculumAdmin },
      { path: 'catalog', name: 'admin-catalog', component: CatalogAdmin },
      { path: 'import', name: 'admin-import', component: ImportAdmin },
      { path: 'access', name: 'admin-access', component: AccessAdmin },
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

export function createAppRouter(history: RouterHistory = createWebHistory()): Router {
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
  return router;
}
