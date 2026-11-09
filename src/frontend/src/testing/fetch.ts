import { vi } from 'vitest';
import { API_URL } from '../api.js';

// Answers fetch by method and path, as `'GET /auth/sessions'`. A value is sent as JSON; a function builds the
// Response (a Response can be read only once). A call nobody expected fails the test.

type Answer = unknown | ((init: RequestInit | undefined) => Response | Promise<Response>);

export function mockApi(routes: Record<string, Answer>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = String(input).slice(API_URL.length).split('?')[0];
    const key = `${init?.method ?? 'GET'} ${path}`;
    if (!Object.hasOwn(routes, key)) throw new Error(`Unexpected API call: ${key}`);
    const answer = routes[key];
    return typeof answer === 'function' ? answer(init) : Response.json(answer);
  });
}

/** The JSON body a mocked call was sent with. */
export const sentBody = (init: RequestInit | undefined): unknown => JSON.parse(String(init?.body));

export const status = (code: number, body?: unknown) => () => (body === undefined ? new Response(null, { status: code }) : Response.json(body, { status: code }));
