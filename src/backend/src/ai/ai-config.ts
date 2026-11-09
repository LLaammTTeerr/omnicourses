import type { aiConfig } from '../config/env.js';

/** The AI settings, read once at boot from config/env.ts. Tests override the provider. */
export const AI_CONFIG = Symbol('AI_CONFIG');
export type AiConfig = ReturnType<typeof aiConfig>;
