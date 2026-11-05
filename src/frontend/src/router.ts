import { createRouter, createWebHistory, type RouteRecordRaw, type RouterScrollBehavior } from 'vue-router';
import GuideView from './views/GuideView.vue';
import GuidesView from './views/GuidesView.vue';
import HomeView from './views/HomeView.vue';

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView },
  // Readable signed out (ADR 0010).
  { path: '/guides', name: 'guides', component: GuidesView },
  { path: '/guides/:id', name: 'guide', component: GuideView, props: true },
];

// Back returns to where the reader was; the skip link (#main) moves to the main content; any other page opens at the top.
export const scrollBehavior: RouterScrollBehavior = (to, _from, saved) => saved ?? (to.hash ? { el: to.hash } : { top: 0 });

export const router = createRouter({ history: createWebHistory(), routes, scrollBehavior });
