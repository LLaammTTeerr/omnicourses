import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Staging and production run at UTC+7 (Vietnam), CI at UTC. Tests run at UTC+7 so a value read
// or written in local time shows up as a wrong day here, not only on the server (issue #174).
// Workers inherit it. TZ=UTC npm test still runs them at UTC.
process.env.TZ ||= 'Asia/Ho_Chi_Minh';

// SWC emits decorator metadata, which NestJS dependency injection needs.
// esbuild (Vite's default transformer) does not.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
  },
});
