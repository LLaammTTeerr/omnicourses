import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

process.env.TZ ||= 'Asia/Ho_Chi_Minh';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
  },
});
