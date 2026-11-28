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
    readonly details: string[] = [],
    readonly code: string | null = null,
    readonly body: Readonly<Record<string, unknown>> | null = null,
  ) {
    super(`${method} ${path} failed: ${status}`);
    this.name = 'HttpError';
  }
}

export interface RequestOptions {
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
  timeout?: number | null;
}

export const REQUEST_TIMEOUT_MS = 30_000;

async function errorBody(res: Response): Promise<{ details: string[]; code: string | null; body: Record<string, unknown> | null }> {
  try {
    const parsed: unknown = await res.json();
    const body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    const { message, code } = body ?? {};
    const details = Array.isArray(message) ? message.filter((m): m is string => typeof m === 'string') : typeof message === 'string' ? [message] : [];
    return { details, code: typeof code === 'string' ? code : null, body };
  } catch {
    return { details: [], code: null, body: null };
  }
}

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
    const { details, code, body } = await errorBody(res);
    throw new HttpError(path, res.status, method, details, code, body);
  }
  return res;
}

export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const res = await send(method, path, { ...options, timeout: options.timeout === undefined ? REQUEST_TIMEOUT_MS : options.timeout });
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export async function fetchHealth(): Promise<Health> {
  try {
    return await request<Health>('GET', '/health');
  } catch (error) {
    if (
      error instanceof HttpError &&
      error.status === 503 &&
      error.body?.status === 'degraded' &&
      error.body?.database === 'down'
    ) {
      return { status: 'degraded', database: 'down' };
    }
    throw error;
  }
}

export const statusOf = (e: unknown): number | null => (e instanceof HttpError ? e.status : null);

export type FailureKind =
  | 'unauthorized'
  | 'invalid'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'server_error'
  | 'timed_out'
  | 'aborted'
  | 'unreachable'
  | 'other';

const FAILURE_BY_STATUS: Readonly<Record<number, FailureKind>> = { 400: 'invalid', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 409: 'conflict', 429: 'rate_limited' };
const FIRST_SERVER_ERROR = 500;

export function failureKind(error: unknown): FailureKind {
  if (!(error instanceof HttpError)) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'aborted';
    if (error instanceof DOMException && error.name === 'TimeoutError') return 'timed_out';
    return 'unreachable';
  }
  if (error.status >= FIRST_SERVER_ERROR) return 'server_error';
  return FAILURE_BY_STATUS[error.status] ?? 'other';
}

export function byField<F extends string>(details: readonly string[], fields: readonly F[]): { fields: Partial<Record<F, string[]>>; other: string[] } {
  const found: Partial<Record<F, string[]>> = {};
  const other: string[] = [];
  for (const detail of details) {
    const field = fields.find((name) => detail.startsWith(name) && !/^[A-Za-z0-9_]/.test(detail.slice(name.length)));
    if (field) (found[field] ??= []).push(detail);
    else other.push(detail);
  }
  return { fields: found, other };
}

export const segment = (value: string): string => {
  const encoded = encodeURIComponent(value);
  return /^\.+$/.test(encoded) ? `${encoded}%20` : encoded;
};

export const codePoints = (text: string): number => [...text].length;
