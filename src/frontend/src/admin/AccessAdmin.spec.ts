import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterView } from 'vue-router';
import { useAuth } from '../auth/store.js';
import { user } from '../auth/testing/fixtures.js';
import { useLocale } from '../locale.js';
import { useToast } from '../shell/toast.js';
import { mockApi, status } from '../testing/fetch.js';
import { chooseOption, optionsOf } from '../testing/select.js';
import { setup } from '../testing/signed-in.js';
import type { UserGrants } from './api.js';
import { ACCESS_MANAGER, accessPrograms, globalGrant, grants, MANAGER_ID, OTHER_PROGRAM_ID, OTHER_USER_ID, PROGRAM_ID, programGrant } from './testing/fixtures.js';

// Synthetic accounts only (AGENTS.md hard rule 3): IDs, never a name or an email.
const OWN_ID = user().id;
const USER = `/admin/access/users/${OTHER_USER_ID}`;
const lost = () => {
  throw new TypeError('Failed to fetch');
};

let wrapper: VueWrapper | undefined;
/** What the API has saved for the looked-up user, and for the access manager themselves. */
let saved: UserGrants;
let own: UserGrants;
const reply = () => Response.json(saved);

async function render(routes: Record<string, unknown> = {}) {
  const fetch = mockApi({
    'GET /admin/grants': () => Response.json(own),
    'GET /admin/access/programs': accessPrograms(),
    [`GET ${USER}/grants`]: reply,
    ...routes,
  });
  const app = await setup('/admin/access');
  wrapper = mount(RouterView, { global: { plugins: [app.pinia, app.router] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, fetch, ...app };
}

type Scope = Pick<DOMWrapper<Element>, 'get'>;
const get = (w: Scope, test: string) => w.get(`[data-test="${test}"]`);
const has = (w: VueWrapper, test: string) => w.find(`[data-test="${test}"]`).exists();
const calls = (fetch: ReturnType<typeof mockApi>, method: string) => fetch.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method);
const writes = (fetch: ReturnType<typeof mockApi>) => fetch.mock.calls.filter(([, init]) => (init?.method ?? 'GET') !== 'GET');
const pathOf = (call: readonly unknown[]) => String(call[0]).split('/api')[1];
const globalRow = (w: VueWrapper, permission: string) => get(w, `access-global-${permission}`);
const state = (w: VueWrapper, permission: string) => [globalRow(w, permission).attributes('data-state'), get(globalRow(w, permission), 'access-status').text()];

async function find(w: VueWrapper, id: string) {
  await get(w, 'access-user-id').setValue(id);
  await w.get('form.access-lookup').trigger('submit');
  await flushPromises();
}
async function click(w: Scope, test: string) {
  const button = get(w, test);
  (button.element as HTMLElement).focus();
  await button.trigger('click');
  await flushPromises();
}

describe('AccessAdmin (F12, UC-11 section 8): grants and revocations of an access manager', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    own = ACCESS_MANAGER;
    saved = grants({ userId: OTHER_USER_ID, programs: [programGrant()], permissions: [globalGrant('catalog_maintainer', { grantedBy: null })] });
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('finds a user by their exact ID and shows their grants: scopes and IDs, nothing else', async () => {
    const { w, fetch } = await render();
    expect(w.get('[data-test="admin-tabs"]').findAll('a').map((a) => a.text())).toEqual(['Phân quyền']);
    expect(get(w, 'access-find').attributes('disabled')).toBeDefined();
    expect(has(w, 'access-user')).toBe(false);
    await find(w, `  ${OTHER_USER_ID} `);
    expect(calls(fetch, 'GET').map(pathOf)).toEqual(['/admin/grants', '/admin/access/programs', `${USER}/grants`]);
    expect(get(w, 'access-user').attributes('data-user-id')).toBe(OTHER_USER_ID);
    expect(get(w, 'access-shown-id').text()).toBe(OTHER_USER_ID);
    expect(has(w, 'access-own')).toBe(false);
    const row = get(w, 'access-program-grant');
    expect(row.attributes('data-program')).toBe('ZZPROG');
    expect(row.findAll('th, td').slice(0, 3).map((cell) => cell.text())).toEqual(['ZZPROG', expect.stringMatching(/^\d\d:\d\d 20\/11\/2026$/), MANAGER_ID]);
    expect(state(w, 'catalog_maintainer')).toEqual(['held', expect.stringMatching(/^Đang có · cấp lúc \d\d:\d\d 20\/11\/2026$/)]);
    expect(state(w, 'access_manager')).toEqual(['not-held', 'Chưa có']);
    expect(optionsOf(get(w, 'access-program'))).toEqual(['ZZEMPTY · Chương trình thử chưa có khóa', 'ZZPROG · Chương trình thử']);
    // Each permission says what it allows, and that it gives no other right.
    expect(globalRow(w, 'access_manager').text()).toContain('Không tự có quyền sửa chương trình hay danh mục.');
  });

  it('says when no account has the ID, and shows the API\'s refusal of a malformed one under the box', async () => {
    const { w } = await render({
      'GET /admin/access/users/00000000-0000-4000-8000-00000000dead/grants': status(404, { statusCode: 404, code: 'not_found', message: 'No account has this ID' }),
      'GET /admin/access/users/zz-not-an-id/grants': status(400, { statusCode: 400, code: 'validation_failed', message: 'userId: must be a UUID' }),
    });
    await find(w, '00000000-0000-4000-8000-00000000dead');
    expect(get(w, 'access-refused').attributes('data-code')).toBe('not_found');
    expect(get(w, 'access-refused').text()).toBe('Không có tài khoản nào mang mã này.');
    expect(has(w, 'access-user')).toBe(false);

    await find(w, 'zz-not-an-id');
    expect(get(w, 'access-refused').attributes('data-code')).toBe('validation_failed');
    expect(get(w, 'access-refused').text()).toBe('Máy chủ không nhận mã này.');
    expect(w.get('#access-user-id-error').text()).toBe('userId: must be a UUID');
    expect(get(w, 'access-user-id').attributes('aria-invalid')).toBe('true');
    expect(get(w, 'access-user-id').attributes('aria-describedby')).toBe('access-hint access-user-id-error');
  });

  it('grants a program to the user, and shows the grants the API answers', async () => {
    const { w, fetch } = await render({
      [`PUT ${USER}/programs/${OTHER_PROGRAM_ID}`]: () => {
        saved = { ...saved, programs: [programGrant({ programId: OTHER_PROGRAM_ID, programCode: 'ZZEMPTY', grantedBy: OWN_ID }), ...saved.programs] };
        return reply();
      },
    });
    await find(w, OTHER_USER_ID);
    expect(get(w, 'access-grant-program').attributes('disabled')).toBeDefined();
    await chooseOption(get(w, 'access-program'), 'ZZEMPTY · Chương trình thử chưa có khóa');
    await w.get('.access-user form').trigger('submit');
    await flushPromises();
    expect(calls(fetch, 'PUT').map(pathOf)).toEqual([`${USER}/programs/${OTHER_PROGRAM_ID}`]);
    expect(calls(fetch, 'PUT')[0]![1]!.body).toBeUndefined();
    expect(w.findAll('[data-test="access-program-grant"]').map((row) => row.attributes('data-program'))).toEqual(['ZZEMPTY', 'ZZPROG']);
    expect(useToast().message).toBe('Đã cấp quyền “Quản trị chương trình ZZEMPTY”.');
    // The choice is cleared, so the same program is not granted twice by accident.
    expect(get(w, 'access-program').text()).toBe('Chọn chương trình');
  });

  it('revokes a program grant only after asking, and sends nothing on Cancel (UC-11 A6)', async () => {
    const { w, fetch } = await render({
      [`DELETE ${USER}/programs/${PROGRAM_ID}`]: () => {
        saved = { ...saved, programs: [] };
        return reply();
      },
    });
    await find(w, OTHER_USER_ID);
    await click(get(w, 'access-program-grant'), 'access-revoke-program');
    const dialog = w.get('dialog[open]');
    expect(dialog.attributes('role')).toBe('alertdialog');
    expect(dialog.text()).toContain('Người dùng này sẽ mất quyền “Quản trị chương trình ZZPROG”. Lần ghi tiếp theo của họ cần quyền đó sẽ bị từ chối.');
    await click(dialog, 'confirm-no');
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(writes(fetch)).toEqual([]);
    expect(document.activeElement).toBe(get(w, 'access-revoke-program').element);

    await click(get(w, 'access-program-grant'), 'access-revoke-program');
    await click(w.get('dialog[open]'), 'confirm-yes');
    expect(calls(fetch, 'DELETE').map(pathOf)).toEqual([`${USER}/programs/${PROGRAM_ID}`]);
    expect(get(w, 'access-no-programs').text()).toBe('Người dùng này chưa quản trị chương trình nào.');
    expect(useToast().message).toBe('Đã thu hồi quyền “Quản trị chương trình ZZPROG”.');
    // The row is gone: the focus goes to the control that can grant a program again.
    expect(document.activeElement).toBe(get(w, 'access-program').element);
  });

  it.each(['catalog_maintainer', 'access_manager'] as const)('grants and revokes the global permission %s', async (permission) => {
    saved = grants({ userId: OTHER_USER_ID });
    const { w, fetch } = await render({
      [`PUT ${USER}/global/${permission}`]: () => {
        saved = { ...saved, permissions: [globalGrant(permission, { grantedBy: OWN_ID })] };
        return reply();
      },
      [`DELETE ${USER}/global/${permission}`]: () => {
        saved = { ...saved, permissions: [] };
        return reply();
      },
    });
    await find(w, OTHER_USER_ID);
    expect(state(w, permission)[0]).toBe('not-held');
    await click(w, `access-grant-${permission}`);
    expect(calls(fetch, 'PUT').map(pathOf)).toEqual([`${USER}/global/${permission}`]);
    expect(state(w, permission)[0]).toBe('held');
    expect(useToast().message).toMatch(/^Đã cấp quyền “Quản l/);
    // Grant became Revoke: the focus stays on the control of this permission.
    expect(document.activeElement).toBe(get(w, `access-revoke-${permission}`).element);

    await click(w, `access-revoke-${permission}`);
    expect(writes(fetch)).toHaveLength(1);
    await click(w.get('dialog[open]'), 'confirm-yes');
    expect(calls(fetch, 'DELETE').map(pathOf)).toEqual([`${USER}/global/${permission}`]);
    expect(state(w, permission)).toEqual(['not-held', 'Chưa có']);
    expect(document.activeElement).toBe(get(w, `access-grant-${permission}`).element);
  });

  it('says in words why the last active access manager cannot be revoked (409 last_access_manager)', async () => {
    saved = grants({ userId: OTHER_USER_ID, permissions: [globalGrant('access_manager')] });
    const { w } = await render({
      [`DELETE ${USER}/global/access_manager`]: status(409, { statusCode: 409, code: 'last_access_manager', message: 'This is the last active access manager; grant the role to someone else first' }),
    });
    await find(w, OTHER_USER_ID);
    await click(w, 'access-revoke-access_manager');
    await click(w.get('dialog[open]'), 'confirm-yes');
    const note = w.get('dialog[open] [data-test="admin-problem"]');
    expect(note.attributes('data-code')).toBe('last_access_manager');
    expect(note.text()).toBe('Đây là người quản lý phân quyền cuối cùng còn hoạt động. Cấp quyền này cho người khác trước khi thu hồi. Chưa đổi gì.');
    expect(state(w, 'access_manager')[0]).toBe('held');
  });

  it('says in words that an account waiting for deletion cannot receive a permission (409 recipient_deletion_pending)', async () => {
    const { w } = await render({
      [`PUT ${USER}/global/access_manager`]: status(409, { statusCode: 409, code: 'recipient_deletion_pending', message: 'That account is waiting for deletion' }),
      [`PUT ${USER}/programs/${OTHER_PROGRAM_ID}`]: status(404, { statusCode: 404, code: 'not_found', message: 'No program has this ID' }),
    });
    await find(w, OTHER_USER_ID);
    await click(w, 'access-grant-access_manager');
    const note = () => get(w, 'access-user').get('[data-test="admin-problem"]');
    expect(note().attributes('data-code')).toBe('recipient_deletion_pending');
    expect(note().text()).toBe('Tài khoản đó đang chờ xóa nên không nhận quyền được. Chưa cấp gì.');
    expect(state(w, 'access_manager')[0]).toBe('not-held');
    expect(useToast().message).toBe('');

    await chooseOption(get(w, 'access-program'), 'ZZEMPTY · Chương trình thử chưa có khóa');
    await w.get('.access-user form').trigger('submit');
    await flushPromises();
    expect(note().attributes('data-code')).toBe('not_found');
  });

  it('names the access-manager permission when the API answers 403 (UC-11 A4)', async () => {
    const denied = status(403, { statusCode: 403, code: 'permission_required', permission: 'access_manager', message: 'This needs the access_manager permission' });
    const { w } = await render({ [`PUT ${USER}/global/catalog_maintainer`]: denied });
    saved = grants({ userId: OTHER_USER_ID });
    await find(w, OTHER_USER_ID);
    await click(w, 'access-grant-catalog_maintainer');
    const note = get(w, 'access-user').get('[data-test="admin-problem"]');
    expect(note.attributes('data-code')).toBe('permission_required');
    expect(note.text()).toBe('Thao tác này cần quyền “Quản lý phân quyền”. Tài khoản của bạn không có quyền đó. Chưa lưu gì.');
  });

  it('marks the access manager\'s own account, and offers a section as soon as they grant it to themselves', async () => {
    saved = grants({ permissions: [globalGrant('access_manager', { grantedBy: null })] });
    const { w, fetch } = await render({
      [`GET /admin/access/users/${OWN_ID}/grants`]: reply,
      [`PUT /admin/access/users/${OWN_ID}/global/catalog_maintainer`]: () => {
        saved = { ...saved, permissions: [...saved.permissions, globalGrant('catalog_maintainer', { grantedBy: OWN_ID })] };
        own = saved;
        return reply();
      },
    });
    await find(w, OWN_ID);
    expect(get(w, 'access-own').text()).toBe('Tài khoản của bạn');
    expect(get(globalRow(w, 'access_manager'), 'access-status').text()).toContain('Đang có');
    expect(w.findAll('.admin-tabs a').map((a) => a.text())).toEqual(['Phân quyền']);
    const before = calls(fetch, 'GET').filter((call) => pathOf(call) === '/admin/grants').length;
    await click(w, 'access-grant-catalog_maintainer');
    expect(calls(fetch, 'GET').filter((call) => pathOf(call) === '/admin/grants').length).toBe(before + 1);
    expect(w.findAll('.admin-tabs a').map((a) => a.text())).toEqual(['Danh mục học phần', 'Nhập CSV', 'Phân quyền']);
  });

  it('warns before the access manager revokes their own permission, then closes the section they no longer hold', async () => {
    saved = grants({ permissions: [globalGrant('access_manager'), globalGrant('catalog_maintainer')] });
    own = saved;
    const { w } = await render({
      [`GET /admin/access/users/${OWN_ID}/grants`]: reply,
      [`DELETE /admin/access/users/${OWN_ID}/global/access_manager`]: () => {
        saved = grants({ permissions: [globalGrant('catalog_maintainer')] });
        own = saved;
        return reply();
      },
    });
    await find(w, OWN_ID);
    await click(w, 'access-revoke-access_manager');
    expect(w.get('dialog[open]').text()).toContain('Đây là tài khoản của bạn: bạn sẽ mất quyền này ngay.');
    await click(w.get('dialog[open]'), 'confirm-yes');
    expect(useToast().message).toBe('Đã thu hồi quyền “Quản lý phân quyền”.');
    expect(has(w, 'access-user')).toBe(false);
    expect(get(w, 'admin-section-denied').attributes('data-permission')).toBe('access_manager');
    expect(w.findAll('.admin-tabs a').map((a) => a.text())).toEqual(['Danh mục học phần', 'Nhập CSV']);
  });

  it('never lets a late answer about one user fill the panel of another: Find waits for the grant that is out', async () => {
    const third = '00000000-0000-4000-8000-000000000003';
    let answer!: (response: Response) => void;
    saved = grants({ userId: OTHER_USER_ID });
    const { w, fetch } = await render({
      [`PUT ${USER}/global/catalog_maintainer`]: () => new Promise<Response>((resolve) => (answer = resolve)),
      [`GET /admin/access/users/${third}/grants`]: grants({ userId: third, programs: [programGrant()] }),
    });
    await find(w, OTHER_USER_ID);
    await click(w, 'access-grant-catalog_maintainer');
    // The grant for the first user is out. Another ID is typed and sent from the keyboard.
    expect(get(w, 'access-find').attributes('disabled')).toBeDefined();
    await find(w, third);
    expect(calls(fetch, 'GET').map(pathOf)).not.toContain(`/admin/access/users/${third}/grants`);
    expect(get(w, 'access-shown-id').text()).toBe(OTHER_USER_ID);

    answer(Response.json({ ...saved, permissions: [globalGrant('catalog_maintainer', { grantedBy: OWN_ID })] }));
    await flushPromises();
    expect(get(w, 'access-shown-id').text()).toBe(OTHER_USER_ID);
    expect(state(w, 'catalog_maintainer')[0]).toBe('held');
    // Now the other user can be looked up, and their panel is their own.
    expect(get(w, 'access-find').attributes('disabled')).toBeUndefined();
    await find(w, third);
    expect(get(w, 'access-shown-id').text()).toBe(third);
    expect(state(w, 'catalog_maintainer')[0]).toBe('not-held');
  });

  it('knows the access manager\'s own account when the ID is typed in capitals', async () => {
    const capitals = 'ABCDEF00-0000-4000-8000-00000000000A';
    const mine = capitals.toLowerCase();
    saved = grants({ userId: capitals, permissions: [globalGrant('access_manager')] });
    own = grants({ userId: mine, permissions: [globalGrant('access_manager')] });
    const fetch = mockApi({
      'GET /admin/grants': () => Response.json(own),
      'GET /admin/access/programs': accessPrograms(),
      [`GET /admin/access/users/${capitals}/grants`]: reply,
      [`PUT /admin/access/users/${capitals}/global/catalog_maintainer`]: () => {
        saved = { ...saved, permissions: [...saved.permissions, globalGrant('catalog_maintainer')] };
        own = { ...saved, userId: mine };
        return reply();
      },
    });
    const app = await setup('/admin/access');
    useAuth(app.pinia).user = user({ id: mine });
    wrapper = mount(RouterView, { global: { plugins: [app.pinia, app.router] }, attachTo: document.body });
    await flushPromises();
    await find(wrapper, capitals);
    // The API answers the ID as it was typed; it is the same account.
    expect(get(wrapper, 'access-own').text()).toBe('Tài khoản của bạn');
    await click(wrapper, 'access-revoke-access_manager');
    expect(wrapper.get('dialog[open]').text()).toContain('Đây là tài khoản của bạn: bạn sẽ mất quyền này ngay.');
    await click(wrapper.get('dialog[open]'), 'confirm-no');
    // A grant to themselves shows in the sections at once.
    await click(wrapper, 'access-grant-catalog_maintainer');
    expect(wrapper.findAll('.admin-tabs a').map((a) => a.text())).toEqual(['Danh mục học phần', 'Nhập CSV', 'Phân quyền']);
    expect(fetch).toHaveBeenCalled();
  });

  it('stays on the page while a grant is out', async () => {
    let answer!: (response: Response) => void;
    saved = grants({ userId: OTHER_USER_ID });
    const { w, router } = await render({ [`PUT ${USER}/global/catalog_maintainer`]: () => new Promise<Response>((resolve) => (answer = resolve)) });
    await find(w, OTHER_USER_ID);
    await click(w, 'access-grant-catalog_maintainer');
    await router.push('/admin/catalog').catch(() => {});
    expect(router.currentRoute.value.name).toBe('admin-access');
    answer(reply());
    await flushPromises();
    await router.push('/admin/catalog');
    expect(router.currentRoute.value.name).toBe('admin-catalog');
  });

  it('warns after Cancel on a revocation whose outcome is unknown, and reads the grants again before another change', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let offline = false;
    saved = grants({ userId: OTHER_USER_ID, programs: [programGrant()] });
    const { w } = await render({
      [`GET ${USER}/grants`]: () => (offline ? lost() : reply()),
      [`DELETE ${USER}/programs/${PROGRAM_ID}`]: () => {
        saved = { ...saved, programs: [] };
        offline = true;
        return lost();
      },
    });
    await find(w, OTHER_USER_ID);
    await click(get(w, 'access-program-grant'), 'access-revoke-program');
    await click(w.get('dialog[open]'), 'confirm-yes');
    expect(w.get('dialog[open] [data-test="admin-problem"]').attributes('data-code')).toBe('unknown');
    expect(get(w.get('dialog[open]'), 'confirm-yes').attributes('disabled')).toBeDefined();
    await click(w.get('dialog[open]'), 'confirm-no');
    expect(get(w, 'access-stale').text()).toContain('Những gì đang hiện có thể đã cũ.');
    expect(get(w, 'access-grant-catalog_maintainer').attributes('disabled')).toBeDefined();
    offline = false;
    await click(w, 'access-reload');
    expect(has(w, 'access-stale')).toBe(false);
    expect(has(w, 'access-no-programs')).toBe(true);
    expect(get(w, 'access-grant-catalog_maintainer').attributes('disabled')).toBeUndefined();
  });

  describe('a grant or a revocation whose answer is lost (UC-11 A7)', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      saved = grants({ userId: OTHER_USER_ID });
    });

    it('reads the user\'s grants again, and says granted only because they now hold it', async () => {
      const { w, fetch } = await render({
        [`PUT ${USER}/global/catalog_maintainer`]: () => {
          saved = { ...saved, permissions: [globalGrant('catalog_maintainer', { grantedBy: OWN_ID })] };
          return lost();
        },
        [`PUT ${USER}/global/access_manager`]: lost,
      });
      await find(w, OTHER_USER_ID);
      const reads = calls(fetch, 'GET').length;
      await click(w, 'access-grant-catalog_maintainer');
      expect(calls(fetch, 'GET').length).toBe(reads + 1);
      expect(get(w, 'admin-notice').text()).toBe('Máy chủ không trả lời yêu cầu lưu, nên OmniCourse đã tải lại dữ liệu đã lưu. Dữ liệu đã lưu có thay đổi này.');
      expect(state(w, 'catalog_maintainer')[0]).toBe('held');
      expect(useToast().message).toBe('');

      await click(w, 'access-grant-access_manager');
      const note = get(w, 'access-user').get('[data-test="admin-problem"]');
      expect(note.attributes('data-code')).toBe('not_applied');
      expect(has(w, 'admin-notice')).toBe(false);
      expect(state(w, 'access_manager')[0]).toBe('not-held');
      expect(calls(fetch, 'PUT')).toHaveLength(2);
    });

    it('says the outcome is unknown when the grants cannot be read again, and reloads them on request', async () => {
      let offline = false;
      const { w } = await render({
        [`GET ${USER}/grants`]: () => (offline ? lost() : reply()),
        [`PUT ${USER}/global/catalog_maintainer`]: () => {
          saved = { ...saved, permissions: [globalGrant('catalog_maintainer', { grantedBy: OWN_ID })] };
          offline = true;
          return lost();
        },
      });
      await find(w, OTHER_USER_ID);
      await click(w, 'access-grant-catalog_maintainer');
      const note = get(w, 'access-user').get('[data-test="admin-problem"]');
      expect(note.attributes('data-code')).toBe('unknown');
      expect(note.text()).toContain('Chưa rõ thay đổi đã được lưu hay chưa.');
      expect(state(w, 'catalog_maintainer')[0]).toBe('not-held');
      expect(useToast().message).toBe('');
      // Reload reads the grants again and settles the same grant from them; it is not sent again.
      offline = false;
      await click(note, 'admin-reload');
      expect(state(w, 'catalog_maintainer')[0]).toBe('held');
      expect(get(w, 'access-user').find('[data-test="admin-problem"]').exists()).toBe(false);
      expect(get(w, 'admin-notice').text()).toBe('Máy chủ không trả lời yêu cầu lưu, nên OmniCourse đã tải lại dữ liệu đã lưu. Dữ liệu đã lưu có thay đổi này.');
      expect(useToast().message).toBe('');
    });

    it('settles a lost revocation in the dialog', async () => {
      saved = grants({ userId: OTHER_USER_ID, programs: [programGrant()] });
      const { w } = await render({ [`DELETE ${USER}/programs/${PROGRAM_ID}`]: status(502) });
      await find(w, OTHER_USER_ID);
      await click(get(w, 'access-program-grant'), 'access-revoke-program');
      await click(w.get('dialog[open]'), 'confirm-yes');
      expect(w.get('dialog[open] [data-test="admin-problem"]').attributes('data-code')).toBe('not_applied');
      expect(w.findAll('[data-test="access-program-grant"]')).toHaveLength(1);
    });
  });

  it('says when the grants or the programs cannot be loaded, and tries again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let down = true;
    const { w } = await render({
      [`GET ${USER}/grants`]: () => (down ? new Response(null, { status: 503 }) : reply()),
      'GET /admin/access/programs': () => (down ? new Response(null, { status: 503 }) : Response.json(accessPrograms())),
    });
    await find(w, OTHER_USER_ID);
    expect(get(w, 'access-failed').text()).toContain('Chưa tải được quyền của người dùng này.');
    down = false;
    await get(w, 'access-failed').get('button').trigger('click');
    await flushPromises();
    expect(has(w, 'access-user')).toBe(true);
    expect(get(w, 'access-programs-failed').text()).toContain('Chưa tải được danh sách chương trình.');
    await get(w, 'access-programs-failed').get('button').trigger('click');
    await flushPromises();
    expect(optionsOf(get(w, 'access-program'))).toHaveLength(2);
  });

  it('reads in English', async () => {
    const { w } = await render();
    useLocale().set('en');
    await find(w, OTHER_USER_ID);
    expect(w.get('#access-admin-title').text()).toBe('Administration access');
    expect(state(w, 'catalog_maintainer')[1]).toMatch(/^Held · granted 20 Nov 2026, \d\d:\d\d$/);
    expect(state(w, 'access_manager')[1]).toBe('Not held');
    expect(get(w, 'access-grant-access_manager').attributes('aria-label')).toBe('Grant the permission Access manager');
    expect(get(w, 'access-program-grant').findAll('td')[1]!.text()).toBe(MANAGER_ID);
    expect(globalRow(w, 'catalog_maintainer').findAll('td')[0]!.text()).toContain('Held');
    await click(get(w, 'access-program-grant'), 'access-revoke-program');
    expect(w.get('dialog[open]').text()).toContain('This user will lose the permission “Program administrator of ZZPROG”.');
  });
});

describe('AccessAdmin (UC-11 A2): an access manager adds a program', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    own = ACCESS_MANAGER;
    saved = grants({ userId: OTHER_USER_ID });
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  const NEW_PROGRAM = { id: '00000000-0000-4000-8000-0000000000a9', code: 'ZZ-NEW', nameVi: 'Chương trình thử mới' };
  const created = () => Response.json({ ...NEW_PROGRAM, nameEn: null, faculty: null, trainingType: null, updatedAt: '2026-11-25T02:00:00.000Z' }, { status: 201 });

  async function fill(w: VueWrapper) {
    await click(w, 'program-add');
    const dialog = w.get('dialog[open]');
    await get(dialog, 'program-code').setValue(' zz-new ');
    await get(dialog, 'program-nameVi').setValue('Chương trình thử mới');
    await w.get('dialog[open] form').trigger('submit');
    await flushPromises();
  }

  it('creates the program with what was typed, then lists it to grant, and says nobody administers it yet', async () => {
    let listed = accessPrograms();
    const { w, fetch } = await render({
      'GET /admin/access/programs': () => Response.json(listed),
      'POST /admin/programs': () => {
        listed = { programs: [...accessPrograms().programs, NEW_PROGRAM] };
        return created();
      },
    });
    await click(w, 'program-add');
    const dialog = w.get('dialog[open]');
    expect(dialog.get('h2').text()).toBe('Chương trình mới');
    // No box for the training type: the API takes none.
    expect(dialog.findAll('input').map((field) => field.attributes('id'))).toEqual(['program-code', 'program-nameVi', 'program-nameEn', 'program-faculty']);
    await get(dialog, 'dialog-cancel').trigger('click');
    await flushPromises();
    expect(writes(fetch)).toEqual([]);

    await fill(w);
    expect(writes(fetch).map((call) => [pathOf(call), JSON.parse(String(call[1]?.body))])).toEqual([['/admin/programs', { code: ' zz-new ', nameVi: 'Chương trình thử mới', nameEn: null, faculty: null }]]);
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(useToast().message).toBe('Đã tạo chương trình ZZ-NEW. Chưa ai quản trị chương trình này: cấp quyền quản trị chương trình cho người phụ trách.');
    await find(w, OTHER_USER_ID);
    expect(optionsOf(get(w, 'access-program'))).toContain('ZZ-NEW · Chương trình thử mới');
    expect(document.activeElement?.getAttribute('data-test')).not.toBe('dialog-save');
  });

  it('says a program code in use in words, under the program, not the catalog', async () => {
    const { w } = await render({ 'POST /admin/programs': status(409, { statusCode: 409, code: 'duplicate_code', message: 'x' }) });
    await fill(w);
    const note = w.get('dialog[open] [data-test="admin-problem"]');
    expect(note.text()).toBe('Đã có chương trình mang mã này. Chưa lưu gì.');
    useLocale().set('en');
    await flushPromises();
    expect(w.get('dialog[open] [data-test="admin-problem"]').text()).toBe('A program has this code already. Nothing was saved.');
  });

  it('settles a lost answer from the list of programs, and sends the program once', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let listed = accessPrograms();
    const { w, fetch } = await render({
      'GET /admin/access/programs': () => Response.json(listed),
      'POST /admin/programs': () => {
        listed = { programs: [...accessPrograms().programs, NEW_PROGRAM] };
        throw new TypeError('Failed to fetch');
      },
    });
    await fill(w);
    expect(calls(fetch, 'POST')).toHaveLength(1);
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(get(w, 'program-notice').text()).toBe('Máy chủ không trả lời yêu cầu lưu, nên OmniCourse đã tải lại dữ liệu đã lưu. Dữ liệu đã lưu có thay đổi này.');
  });

  it('says when the lost program is not in the list, and keeps the dialog to try again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render({ 'POST /admin/programs': lost });
    await fill(w);
    expect(w.get('dialog[open] [data-test="admin-problem"]').attributes('data-code')).toBe('not_applied');
  });
});
