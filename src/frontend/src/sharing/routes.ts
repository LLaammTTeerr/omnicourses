import type { RouteRecordRaw } from 'vue-router';

export const sharingRoutes: RouteRecordRaw[] = [
  { path: '/shared/:token', name: 'shared-plan', component: () => import('./SharedPlanView.vue'), props: true, meta: { layout: 'auto' } },
];
