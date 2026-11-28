import type { RouteRecordRaw } from 'vue-router';
import { APP_PAGE } from '../route-meta.js';
import { ADMIN_SECTIONS } from './sections.js';

export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin',
    name: 'admin',
    component: () => import('./AdminView.vue'),
    meta: {
      ...APP_PAGE,
      onboarding: 'optional',
      menu: { icon: 'db', label: { vi: 'Quản trị', en: 'Administration' }, group: 'thesis', section: 'account', grant: true },
    },
    children: ADMIN_SECTIONS.map(({ path, route, load }) => ({ path, name: route, component: load })),
  },
];
