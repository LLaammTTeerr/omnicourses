import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Calls the real model through OpenRouter. Manual only, never in CI (ADR 0003):
// needs OPENROUTER_API_KEY, AI_MODEL_STRUCTURED and AI_MODEL_CHAT, and spends credit.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.live-spec.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
});
