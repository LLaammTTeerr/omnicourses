import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.base.config.mjs';

// Calls the real model through OpenRouter. Manual only, never in CI (ADR 0003):
// needs OPENROUTER_API_KEY, AI_MODEL_STRUCTURED and AI_MODEL_CHAT, and spends credit.
export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ['src/**/*.live-spec.ts'],
      testTimeout: 60_000,
    },
  }),
);
