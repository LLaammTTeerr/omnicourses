import { createPinia, setActivePinia } from 'pinia';
import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/store.js';
import { user } from '../auth/testing/fixtures.js';
import { mockApi } from '../testing/fetch.js';
import { useAdminAccess } from './access.js';
import { reloadProgramsOnGrantChange, useProgramPicker } from './store.js';
import { adminPrograms, NO_GRANTS, PROGRAM_ADMIN } from './testing/fixtures.js';

const programReads = (fetch: ReturnType<typeof mockApi>) => fetch.mock.calls.filter((call) => String(call[0]).endsWith('/admin/programs')).length;

async function loadedPicker(withReload: boolean) {
  setActivePinia(createPinia());
  const auth = useAuth();
  auth.token = 'zz-token';
  auth.user = user();
  const access = useAdminAccess();
  access.seed(auth.user.id, NO_GRANTS);
  const fetch = mockApi({ 'GET /admin/programs': adminPrograms() });
  const picker = useProgramPicker('the programs to administer');
  if (withReload) reloadProgramsOnGrantChange(picker);
  await picker.loadPrograms();
  access.seed(auth.user.id, PROGRAM_ADMIN);
  await flushPromises();
  return fetch;
}

describe('reloading the program list when the grants change', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('does not happen for a picker alone', async () => {
    expect(programReads(await loadedPicker(false))).toBe(1);
  });

  it('happens for a picker given reloadProgramsOnGrantChange', async () => {
    expect(programReads(await loadedPicker(true))).toBe(2);
  });
});
