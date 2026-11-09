// api.spec.ts checks this against HealthDto in src/backend/openapi.json.
export interface Health {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
}

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export class HttpError extends Error {
  constructor(
    path: string,
    readonly status: number,
    method = 'GET',
    /** The messages of a Nest error body, such as each failed validation of a 400. */
    readonly details: string[] = [],
  ) {
    super(`${method} ${path} failed: ${status}`);
    this.name = 'HttpError';
  }
}

/** A public read: no token is sent (ADR 0010). */
export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new HttpError(path, res.status);
  return res.json() as Promise<T>;
}

export interface RequestOptions {
  body?: unknown;
  /** The session token (ADR 0002), sent as `Authorization: Bearer`. */
  token?: string | null;
}

async function errorDetails(res: Response): Promise<string[]> {
  try {
    const body: unknown = await res.json();
    const message = body && typeof body === 'object' ? (body as { message?: unknown }).message : undefined;
    if (Array.isArray(message)) return message.filter((m): m is string => typeof m === 'string');
    return typeof message === 'string' ? [message] : [];
  } catch {
    return [];
  }
}

/** Sends a request with an optional JSON body and token; throws HttpError on any status but 2xx. */
export async function send(method: string, path: string, { body, token }: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) throw new HttpError(path, res.status, method, await errorDetails(res));
  return res;
}

/** Like send, with the JSON answer parsed. Resolves to undefined on 204 No Content. */
export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const res = await send(method, path, options);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export function fetchHealth(): Promise<Health> {
  return getJson<Health>('/health');
}

/** The HTTP status of a failed call, or null when the request never got an answer (offline, CORS, DNS). */
export const statusOf = (e: unknown): number | null => (e instanceof HttpError ? e.status : null);
