import type { RouteRecordRaw } from 'vue-router';

export const authRoutes: RouteRecordRaw[] = [
  { path: '/sign-in', name: 'sign-in', component: () => import('./SignInView.vue'), meta: { layout: 'bare', auth: 'guest' } },
  { path: '/sign-up', name: 'sign-up', component: () => import('./SignUpView.vue'), meta: { layout: 'bare', auth: 'guest' } },
];
