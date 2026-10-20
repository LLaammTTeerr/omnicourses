export interface Health {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  postgresVersion: string | null;
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export async function fetchHealth(): Promise<Health> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error(`GET /health failed: ${res.status}`);
  return res.json() as Promise<Health>;
}
