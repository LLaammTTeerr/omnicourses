import type { RouteRecordRaw } from 'vue-router';
import { APP_PAGE } from '../route-meta.js';

export const planRoutes: RouteRecordRaw[] = [
  {
    path: '/plans',
    meta: APP_PAGE,
    children: [
      {
        path: '',
        name: 'plans',
        component: () => import('./PlannerEntry.vue'),
        meta: { menu: { icon: 'columns', label: { vi: 'Lộ trình', en: 'Plans' }, group: 'elec', section: 'main', phoneTab: 2 } },
      },
      { path: 'all', name: 'plan-list', component: () => import('./PlansView.vue') },
      { path: ':id', name: 'plan', component: () => import('./PlanEditorView.vue'), props: true },
    ],
  },
];
