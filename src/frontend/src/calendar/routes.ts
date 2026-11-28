import type { RouteRecordRaw } from 'vue-router';
import { APP_PAGE } from '../route-meta.js';

export const calendarRoutes: RouteRecordRaw[] = [
  {
    path: '/calendar',
    name: 'calendar',
    component: () => import('./CalendarView.vue'),
    meta: { ...APP_PAGE, menu: { icon: 'calendar', label: { vi: 'Lịch', en: 'Calendar' }, group: 'pol', section: 'main' } },
  },
];
