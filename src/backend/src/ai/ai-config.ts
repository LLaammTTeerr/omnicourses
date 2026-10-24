// Read at call time, not at import, so tests and a changed .env take effect
// without a rebuild. A missing key or model is not a startup error: the app
// boots and AI calls answer 503 `ai_unavailable` (ADR 0003, robustness NFR).
export function aiConfig() {
  const env = process.env;
  return {
    apiKey: env.OPENROUTER_API_KEY || null,
    structuredModel: env.AI_MODEL_STRUCTURED || null,
    chatModel: env.AI_MODEL_CHAT || null,
    timeoutMs: Number(env.AI_TIMEOUT_MS ?? 30_000),
    dailyCallsPerUser: Number(env.AI_DAILY_CALLS_PER_USER ?? 20),
  };
}
