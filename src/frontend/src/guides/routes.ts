import type { RouteRecordRaw } from 'vue-router';

export const guideRoutes: RouteRecordRaw[] = [
  {
    path: '/guides',
    name: 'guides',
    component: () => import('./GuidesView.vue'),
    meta: {
      layout: 'auto',
      keepAlive: true,
      menu: { icon: 'book', label: { vi: 'Hướng dẫn', en: 'Guides' }, group: 'math', section: 'main', visitors: true },
    },
  },
  { path: '/guides/:id', name: 'guide', component: () => import('./GuideView.vue'), props: true, meta: { layout: 'auto' } },
];
