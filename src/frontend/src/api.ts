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
    /** The machine-readable `code` of the error body, such as `onboarding_required` on a 409, or null. */
    readonly code: string | null = null,
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
  /** Aborts the request, with any timeout. */
  signal?: AbortSignal;
  /**
   * Milliseconds before the request fails, reading the answer included; null for none. `request` defaults to
   * REQUEST_TIMEOUT_MS; `send` has none, for a download or a stream that may take longer.
   */
  timeout?: number | null;
}

/**
 * How long a JSON call may take before it fails, so a hung connection ends in an error the screen can say and
 * re-enables its buttons. The server may still have done what a timed-out write asked.
 */
export const REQUEST_TIMEOUT_MS = 30_000;

async function errorBody(res: Response): Promise<{ details: string[]; code: string | null }> {
  try {
    const body: unknown = await res.json();
    const { message, code } = body && typeof body === 'object' ? (body as { message?: unknown; code?: unknown }) : {};
    const details = Array.isArray(message) ? message.filter((m): m is string => typeof m === 'string') : typeof message === 'string' ? [message] : [];
    return { details, code: typeof code === 'string' ? code : null };
  } catch {
    return { details: [], code: null };
  }
}

/** Sends a request with an optional JSON body and token; throws HttpError on any status but 2xx. */
export async function send(method: string, path: string, { body, token, signal, timeout }: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const signals = [signal, timeout == null ? undefined : AbortSignal.timeout(timeout)].filter((s) => s !== undefined);
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    ...(signals.length > 0 && { signal: signals.length === 1 ? signals[0] : AbortSignal.any(signals) }),
  });
  if (!res.ok) {
    const { details, code } = await errorBody(res);
    throw new HttpError(path, res.status, method, details, code);
  }
  return res;
}

/** Like send, with the JSON answer parsed and a timeout of REQUEST_TIMEOUT_MS by default. Resolves to undefined on 204. */
export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const res = await send(method, path, { ...options, timeout: options.timeout === undefined ? REQUEST_TIMEOUT_MS : options.timeout });
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export function fetchHealth(): Promise<Health> {
  return getJson<Health>('/health');
}

/** The HTTP status of a failed call, or null when the request never got an answer (offline, CORS, DNS). */
export const statusOf = (e: unknown): number | null => (e instanceof HttpError ? e.status : null);
