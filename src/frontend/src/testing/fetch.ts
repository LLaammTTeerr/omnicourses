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

/** An answer that comes only when the request's signal aborts, as on a hung connection; usable as a mockApi route. */
export const hung = (init: RequestInit | undefined) =>
  new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)));

/** Every fetch hangs until its signal aborts. */
export const hang = () => vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => hung(init));

/**
 * Closes a <dialog> as a browser without `closedby` does on a second Escape while busy (see
 * ModalDialog.browser.spec.ts). jsdom has no close watcher, so specs close it this way.
 */
export function closeNatively(dialog: Element): void {
  dialog.removeAttribute('open');
  dialog.dispatchEvent(new Event('close'));
}

export const status = (code: number, body?: unknown) => () => (body === undefined ? new Response(null, { status: code }) : Response.json(body, { status: code }));
