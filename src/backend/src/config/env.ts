import { existsSync } from 'node:fs';

const ENV_FILES = ['.env', '../../.env'];

export function loadEnvFiles(): void {
  for (const file of ENV_FILES) if (existsSync(file)) process.loadEnvFile(file);
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value?.trim() || NaN);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const port = (): number => positiveInt(process.env.PORT, 3000);

export const trustProxy = (): string | undefined => process.env.TRUST_PROXY?.trim() || undefined;

export const listenHost = (): string | undefined => process.env.LISTEN_HOST?.trim() || undefined;

export const corsOrigin = (): string => process.env.CORS_ORIGIN ?? 'http://localhost:5173';

export const databaseUrl = (): string | undefined => process.env.DATABASE_URL;

export const nodeEnv = (): string | undefined => process.env.NODE_ENV;

export function apiDocs(): boolean {
  const flag = process.env.API_DOCS?.trim().toLowerCase();
  if (flag === 'true' || flag === 'false') return flag === 'true';
  return nodeEnv() !== 'production';
}

export const sessionTtlDays = (): number => positiveInt(process.env.SESSION_TTL_DAYS, 7);

export const accountDeletionGraceDays = (): number => positiveInt(process.env.ACCOUNT_DELETION_GRACE_DAYS, 30);

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

export const AI_CONFIG = Symbol('AI_CONFIG');
export type AiConfig = ReturnType<typeof aiConfig>;
