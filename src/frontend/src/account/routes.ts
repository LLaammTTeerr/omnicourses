import type { RouteRecordRaw } from 'vue-router';
import { APP_PAGE } from '../route-meta.js';

export const accountRoutes: RouteRecordRaw[] = [
  {
    path: '/settings',
    name: 'settings',
    component: () => import('./SettingsView.vue'),
    meta: {
      ...APP_PAGE,
      onboarding: 'optional',
      menu: { icon: 'sliders', label: { vi: 'Cài đặt', en: 'Settings' }, group: 'thesis', section: 'account' },
    },
  },
];
