import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import HomeView from './HomeView.vue';

describe('HomeView in a real browser', () => {
  let host: HTMLDivElement;
  let wrapper: VueWrapper | undefined;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    host.remove();
    vi.restoreAllMocks();
  });

  it('shows the home page while loading, then the API and database status', async () => {
    let respond!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => { respond = resolve; });
    const fetch = vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(response);
    wrapper = mount(HomeView, { attachTo: host });

    await expect.element(page.getByRole('heading', { name: 'OmniCourse', exact: true })).toBeVisible();
    await expect.element(page.getByText('Checking API…')).toBeVisible();
    expect(fetch).toHaveBeenCalledWith(
      `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'}/health`,
    );

    respond(Response.json({ status: 'ok', database: 'up', postgresVersion: '18.6' }));

    await expect.element(page.getByText('API ok · database up (PostgreSQL 18.6)')).toBeVisible();
    await expect.element(page.getByText('Checking API…')).not.toBeInTheDocument();
  });

  it('shows a degraded database response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({ status: 'degraded', database: 'down', postgresVersion: null }),
    );
    wrapper = mount(HomeView, { attachTo: host });

    await expect.element(page.getByText('API degraded · database down')).toBeVisible();
  });

  it('shows an unsuccessful HTTP response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 503 }));
    wrapper = mount(HomeView, { attachTo: host });

    await expect.element(page.getByText('API unreachable: GET /health failed: 503')).toBeVisible();
  });

  it('shows a network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    wrapper = mount(HomeView, { attachTo: host });

    await expect.element(page.getByText('API unreachable: Failed to fetch')).toBeVisible();
  });
});
