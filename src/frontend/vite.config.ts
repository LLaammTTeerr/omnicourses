import vue from '@vitejs/plugin-vue';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    exclude: [...configDefaults.exclude, 'src/**/*.browser.spec.ts'],
  },
});
