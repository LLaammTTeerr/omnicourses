// api.spec.ts checks this against HealthDto in src/backend/openapi.json.
export interface Health {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  postgresVersion: string | null;
}

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export class HttpError extends Error {
  constructor(
    path: string,
    readonly status: number,
  ) {
    super(`GET ${path} failed: ${status}`);
    this.name = 'HttpError';
  }
}

export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new HttpError(path, res.status);
  return res.json() as Promise<T>;
}

export function fetchHealth(): Promise<Health> {
  return getJson<Health>('/health');
}
