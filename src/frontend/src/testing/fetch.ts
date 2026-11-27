import { vi } from 'vitest';
import { API_URL } from '../api.js';

type Answer = unknown | ((init: RequestInit | undefined, url: string) => Response | Promise<Response>);

export function mockApi(routes: Record<string, Answer>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = String(input).slice(API_URL.length).split('?')[0];
    const key = `${init?.method ?? 'GET'} ${path}`;
    if (!Object.hasOwn(routes, key)) throw new Error(`Unexpected API call: ${key}`);
    const answer = routes[key];
    return typeof answer === 'function' ? answer(init, String(input)) : Response.json(answer);
  });
}

export const sentBody = (init: RequestInit | undefined): unknown => JSON.parse(String(init?.body));

export const hung = (init: RequestInit | undefined) =>
  new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)));

export const hang = () => vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => hung(init));

export function closeNatively(dialog: Element): void {
  dialog.removeAttribute('open');
  dialog.dispatchEvent(new Event('close'));
}

export const status = (code: number, body?: unknown) => () => (body === undefined ? new Response(null, { status: code }) : Response.json(body, { status: code }));
