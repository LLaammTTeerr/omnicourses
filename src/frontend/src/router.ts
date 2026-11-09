import { getActivePinia } from 'pinia';
import { createRouter, createWebHistory, type RouteRecordRaw, type Router, type RouterHistory, type RouterScrollBehavior } from 'vue-router';
import SettingsView from './account/SettingsView.vue';
import { afterSignIn } from './auth/redirect.js';
import SignInView from './auth/SignInView.vue';
import SignUpView from './auth/SignUpView.vue';
import { useAuth } from './auth/store.js';
import GuideView from './guides/GuideView.vue';
import GuidesView from './guides/GuidesView.vue';
import TranscriptView from './transcript/TranscriptView.vue';
import HomeView from './views/HomeView.vue';

declare module 'vue-router' {
  interface RouteMeta {
    /** App.vue keeps the page alive while another page is open. */
    keepAlive?: boolean;
    /**
     * The frame App.vue draws around the page: `public` the header for visitors, `app` the sidebar, `bare` none
     * (sign-in and sign-up), `auto` the sidebar when signed in and the public header when not. Default `public`.
     */
    layout?: 'public' | 'app' | 'bare' | 'auto';
    /** `required`: signed out goes to sign-in and comes back. `guest`: signed in goes on to the app. */
    auth?: 'required' | 'guest';
  }
}

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView, meta: { layout: 'public' } },
  { path: '/sign-in', name: 'sign-in', component: SignInView, meta: { layout: 'bare', auth: 'guest' } },
  { path: '/sign-up', name: 'sign-up', component: SignUpView, meta: { layout: 'bare', auth: 'guest' } },
  // Readable signed out (ADR 0010).
  // The guide list stays alive while a guide is open, so Back finds the same search and scroll position.
  { path: '/guides', name: 'guides', component: GuidesView, meta: { layout: 'auto', keepAlive: true } },
  { path: '/guides/:id', name: 'guide', component: GuideView, props: true, meta: { layout: 'auto' } },
  { path: '/transcript', name: 'transcript', component: TranscriptView, meta: { layout: 'app', auth: 'required' } },
  { path: '/settings', name: 'settings', component: SettingsView, meta: { layout: 'app', auth: 'required' } },
  { path: '/:unknown(.*)*', redirect: '/' },
];

const scrollBehavior: RouterScrollBehavior = (to, _from, saved) => saved ?? (to.hash ? { el: to.hash } : { top: 0 });

export function createAppRouter(history: RouterHistory = createWebHistory()): Router {
  const router = createRouter({ history, routes, scrollBehavior });
  router.beforeEach(async (to) => {
    // A router navigated before the app installs Pinia (some tests) has nobody signed in.
    const auth = getActivePinia() ? useAuth() : null;
    await auth?.start();
    const signedIn = auth?.signedIn ?? false;
    if (to.meta.auth === 'required' && !signedIn) return { name: 'sign-in', query: { redirect: to.fullPath } };
    if (to.meta.auth === 'guest' && signedIn) return afterSignIn(to.query.redirect);
    return true;
  });
  return router;
}
