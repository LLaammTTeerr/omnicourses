import { createPinia } from 'pinia';
import { createApp, type App as VueApp } from 'vue';
import type { Router } from 'vue-router';
import App from './App.vue';
import { createAppRouter } from './router.js';

export function createOmniCourseApp(router: Router = createAppRouter()): VueApp {
  return createApp(App).use(createPinia()).use(router);
}
