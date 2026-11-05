import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import GuideView from './views/GuideView.vue';
import GuidesView from './views/GuidesView.vue';
import HomeView from './views/HomeView.vue';

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView },
  // Readable signed out (ADR 0010).
  { path: '/guides', name: 'guides', component: GuidesView },
  { path: '/guides/:id', name: 'guide', component: GuideView, props: true },
];

export const router = createRouter({ history: createWebHistory(), routes, scrollBehavior: () => ({ top: 0 }) });
