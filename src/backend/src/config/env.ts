import { existsSync } from 'node:fs';

// Every setting the backend reads from the environment. Each getter reads
// process.env when it is called, never at import, so loadEnvFiles() only has
// to run before the first use.

// A .env next to the backend, then the repository's. A variable already set
// (shell, CI) wins over both, and the first file wins over the second.
const ENV_FILES = ['.env', '../../.env'];

export function loadEnvFiles(): void {
  // process.loadEnvFile throws on a missing file.
  for (const file of ENV_FILES) if (existsSync(file)) process.loadEnvFile(file);
}

// A blank, non-numeric, zero or negative value falls back to the default:
// '' would otherwise read as 0 and a typo as NaN, and both silently change
// behaviour (a 0 ms timeout, a cap that never triggers, a 0-day grace period).
function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value?.trim() || NaN);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export const port = (): number => positiveInt(process.env.PORT, 3000);

// Behind a reverse proxy every request arrives from the proxy, so the per-address rate limits
// (ADR 0002) would count all visitors as one. TRUST_PROXY is Express's `trust proxy` value:
// `loopback` when nginx runs on the same host. Unset, the TCP peer is the client.
export const trustProxy = (): string | undefined => process.env.TRUST_PROXY?.trim() || undefined;

// The interface the API listens on: `127.0.0.1` behind a local proxy. Unset, every interface.
export const listenHost = (): string | undefined => process.env.LISTEN_HOST?.trim() || undefined;

export const corsOrigin = (): string => process.env.CORS_ORIGIN ?? 'http://localhost:5173';

export const databaseUrl = (): string | undefined => process.env.DATABASE_URL;

export const nodeEnv = (): string | undefined => process.env.NODE_ENV;

// The Swagger pages (/api/docs, /api/docs-json). Off in production, since they
// map the API for anyone, unless API_DOCS=true (a staging server testers use).
// API_DOCS=false turns them off anywhere. Issue #28.
export function apiDocs(): boolean {
  const flag = process.env.API_DOCS?.trim().toLowerCase();
  if (flag === 'true' || flag === 'false') return flag === 'true';
  return nodeEnv() !== 'production';
}

export const sessionTtlDays = (): number => positiveInt(process.env.SESSION_TTL_DAYS, 7);

export const accountDeletionGraceDays = (): number => positiveInt(process.env.ACCOUNT_DELETION_GRACE_DAYS, 30);

// A missing key or model is not a startup error: the app boots and AI calls
// answer 503 `ai_unavailable` (ADR 0003, robustness NFR).
export function aiConfig() {
  const env = process.env;
  return {
    apiKey: env.OPENROUTER_API_KEY || null,
    structuredModel: env.AI_MODEL_STRUCTURED || null,
    chatModel: env.AI_MODEL_CHAT || null,
    timeoutMs: positiveInt(env.AI_TIMEOUT_MS, 30_000),
    dailyCallsPerUser: positiveInt(env.AI_DAILY_CALLS_PER_USER, 20),
  };
}
