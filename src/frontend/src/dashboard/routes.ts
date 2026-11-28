import type { RouteRecordRaw } from 'vue-router';
import { APP_PAGE } from '../route-meta.js';

export const dashboardRoutes: RouteRecordRaw[] = [
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('./DashboardView.vue'),
    meta: { ...APP_PAGE, menu: { icon: 'home', label: { vi: 'Tổng quan', en: 'Dashboard' }, group: 'core', section: 'main', phoneTab: 1 } },
  },
];
