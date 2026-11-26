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
    /** The whole JSON error body, for the fields an error adds beside `code` (the `permission` of a 403); null when it is not a JSON object. */
    readonly body: Readonly<Record<string, unknown>> | null = null,
  ) {
    super(`${method} ${path} failed: ${status}`);
    this.name = 'HttpError';
  }
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
    const { details, code, body } = await errorBody(res);
    throw new HttpError(path, res.status, method, details, code, body);
  }
  return res;
}

/** Like send, with the JSON answer parsed and a timeout of REQUEST_TIMEOUT_MS by default. Resolves to undefined on 204. */
export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const res = await send(method, path, { ...options, timeout: options.timeout === undefined ? REQUEST_TIMEOUT_MS : options.timeout });
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export function fetchHealth(): Promise<Health> {
  return request<Health>('GET', '/health');
}

/** The HTTP status of a failed call, or null when the request never got an answer (offline, CORS, DNS). */
export const statusOf = (e: unknown): number | null => (e instanceof HttpError ? e.status : null);

export type FailureKind = 'unauthorized' | 'invalid' | 'forbidden' | 'not_found' | 'conflict' | 'rate_limited' | 'server_error' | 'timed_out' | 'unreachable' | 'other';

const FAILURE_BY_STATUS: Readonly<Record<number, FailureKind>> = { 400: 'invalid', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 409: 'conflict', 429: 'rate_limited' };
const FIRST_SERVER_ERROR = 500;

export function failureKind(error: unknown): FailureKind {
  if (!(error instanceof HttpError)) return error instanceof DOMException && error.name === 'TimeoutError' ? 'timed_out' : 'unreachable';
  if (error.status >= FIRST_SERVER_ERROR) return 'server_error';
  return FAILURE_BY_STATUS[error.status] ?? 'other';
}

/**
 * The API's validation messages by the field each one names at its start ("credits must not be less than 1",
 * "prerequisites: ZZ101 not a course of this curriculum"). A message that names none of `fields`, such as an
 * unknown property, is in `other`. The messages are the API's English text: it sends no code per field.
 */
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

/**
 * One path segment of an API address, from a value the user typed or an ID. A segment of only dots would be
 * resolved by the browser as a relative path ("." this folder, ".." the one above), so the request would reach
 * another address; a trailing space keeps it one segment, and the API then refuses it as a value or answers 404.
 */
export const segment = (value: string): string => {
  const encoded = encodeURIComponent(value);
  return /^\.+$/.test(encoded) ? `${encoded}%20` : encoded;
};

/**
 * A text's length as the API counts it (#179): in code points, as PostgreSQL does. `.length` counts UTF-16 units, so
 * an emoji counts twice there, and the HTML maxlength attribute counts the same way.
 */
export const codePoints = (text: string): number => [...text].length;
