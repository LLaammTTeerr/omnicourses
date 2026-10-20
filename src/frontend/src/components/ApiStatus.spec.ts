import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ApiStatus from './ApiStatus.vue';

describe('ApiStatus', () => {
  it('shows the API and database state once loaded', async () => {
    const wrapper = mount(ApiStatus, {
      props: { load: async () => ({ status: 'ok', database: 'up', postgresVersion: '18.6' }) },
    });
    await flushPromises();
    expect(wrapper.get('[data-test="status"]').text()).toContain('API ok · database up');
    expect(wrapper.text()).toContain('PostgreSQL 18.6');
  });

  it('shows an error when the API cannot be reached', async () => {
    const wrapper = mount(ApiStatus, {
      props: { load: async () => Promise.reject(new Error('Failed to fetch')) },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('API unreachable: Failed to fetch');
  });
});
