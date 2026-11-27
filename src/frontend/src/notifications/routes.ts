import type { RouteRecordRaw } from 'vue-router';
import { APP_PAGE } from '../route-meta.js';

export const notificationRoutes: RouteRecordRaw[] = [
  {
    path: '/notifications',
    name: 'notifications',
    component: () => import('./NotificationsView.vue'),
    meta: {
      ...APP_PAGE,
      menu: { icon: 'bell', label: { vi: 'Thông báo', en: 'Notifications' }, group: 'pol', section: 'main', unreadBadge: true },
    },
  },
];
