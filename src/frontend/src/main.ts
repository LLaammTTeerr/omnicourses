import { createOmniCourseApp } from './app.js';
import { reloadOnStaleChunk } from './router.js';

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  reloadOnStaleChunk(`${window.location.pathname}${window.location.search}${window.location.hash}`);
});

createOmniCourseApp().mount('#app');
