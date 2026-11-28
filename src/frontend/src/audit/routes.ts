import type { RouteRecordRaw } from 'vue-router';
import { APP_PAGE } from '../route-meta.js';

export const auditRoutes: RouteRecordRaw[] = [
  {
    path: '/audit',
    name: 'audit',
    component: () => import('./AuditView.vue'),
    meta: {
      ...APP_PAGE,
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
];
