import type { RouteRecordRaw } from 'vue-router';
import { APP_PAGE } from '../route-meta.js';

export const transcriptRoutes: RouteRecordRaw[] = [
  {
    path: '/transcript',
    name: 'transcript',
    component: () => import('./TranscriptView.vue'),
    meta: { ...APP_PAGE, menu: { icon: 'file', label: { vi: 'Bảng điểm', en: 'Transcript' }, group: 'gen', section: 'main' } },
  },
];
