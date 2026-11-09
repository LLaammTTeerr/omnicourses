import { createRouter, createWebHistory, type RouteRecordRaw, type Router, type RouterHistory, type RouterScrollBehavior } from 'vue-router';
import GuideView from './guides/GuideView.vue';
import GuidesView from './guides/GuidesView.vue';
import HomeView from './views/HomeView.vue';

declare module 'vue-router' {
  interface RouteMeta {
    /** App.vue keeps the page alive while another page is open. */
    keepAlive?: boolean;
  }
}

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView },
  // Readable signed out (ADR 0010).
  // The guide list stays alive while a guide is open, so Back finds the same search and scroll position.
  { path: '/guides', name: 'guides', component: GuidesView, meta: { keepAlive: true } },
  { path: '/guides/:id', name: 'guide', component: GuideView, props: true },
];

const scrollBehavior: RouterScrollBehavior = (to, _from, saved) => saved ?? (to.hash ? { el: to.hash } : { top: 0 });

export function createAppRouter(history: RouterHistory = createWebHistory()): Router {
  return createRouter({ history, routes, scrollBehavior });
}
