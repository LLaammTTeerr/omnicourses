import type { RouteRecordRaw } from 'vue-router';

export const privacyRoutes: RouteRecordRaw[] = [
  { path: '/privacy', name: 'privacy', component: () => import('./PrivacyView.vue'), meta: { layout: 'auto' } },
];
