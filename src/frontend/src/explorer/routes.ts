import type { RouteRecordRaw } from 'vue-router';
import { APP_PAGE } from '../route-meta.js';

export const explorerRoutes: RouteRecordRaw[] = [
  {
    path: '/explorer',
    name: 'explorer',
    component: () => import('./ExplorerView.vue'),
    meta: { ...APP_PAGE, menu: { icon: 'graph', label: { vi: 'Chương trình', en: 'Curriculum' }, group: 'phys', section: 'main', phoneTab: 4 } },
  },
];
