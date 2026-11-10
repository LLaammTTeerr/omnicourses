import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { createMemoryHistory } from 'vue-router';
import { API_URL } from '../api.js';
import { createAppRouter } from '../router.js';
import { HEALTHY } from '../testing/health.js';
import HomeView from './HomeView.vue';

describe('HomeView in a real browser', () => {
  let host: HTMLDivElement;
  let wrapper: VueWrapper | undefined;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
  });

  // The landing page links to sign-up and the guides, and reads the language and the session from Pinia.
  const plugins = () => [createPinia(), createAppRouter(createMemoryHistory())];

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
    wrapper = mount(HomeView, { attachTo: host, global: { plugins: plugins() } });

    await expect.element(page.getByRole('heading', { level: 1, name: 'Biết chính xác còn thiếu gì để tốt nghiệp.' })).toBeVisible();
    await expect.element(page.getByText('Checking API…')).toBeVisible();
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/health`, expect.objectContaining({ method: 'GET', headers: {} }));

    respond(Response.json(HEALTHY));

    await expect.element(page.getByText('API ok · database up')).toBeVisible();
    await expect.element(page.getByText('Checking API…')).not.toBeInTheDocument();
  });

  it('shows a degraded database response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({ status: 'degraded', database: 'down' }),
    );
    wrapper = mount(HomeView, { attachTo: host, global: { plugins: plugins() } });

    await expect.element(page.getByText('API degraded · database down')).toBeVisible();
  });

  it('shows an unsuccessful HTTP response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 503 }));
    wrapper = mount(HomeView, { attachTo: host, global: { plugins: plugins() } });

    await expect.element(page.getByText('API unreachable: GET /health failed: 503')).toBeVisible();
  });

  it('shows a network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    wrapper = mount(HomeView, { attachTo: host, global: { plugins: plugins() } });

    await expect.element(page.getByText('API unreachable: Failed to fetch')).toBeVisible();
  });
});
