import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC emits decorator metadata, which NestJS dependency injection needs.
// esbuild (Vite's default transformer) does not.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      include: [
        'src/**/*.ts',
      ],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/testing/**',
        'src/database/migrations/**',
        'src/main.ts',
        'src/**/*.live-spec.ts'
      ],
      thresholds: {
        'src/rules/**': {
          statements: 80,
        }
      }
    }
  },
});
