import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { useLocale } from '../locale.js';
import { mockApi } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import PrivacyView from './PrivacyView.vue';

let wrapper: VueWrapper | undefined;

async function render(signedIn = false) {
  // The notice is static: any API call is a mistake, and mockApi fails it.
  const fetch = mockApi({});
  const { pinia, router } = await setup('/privacy', { signedIn });
  wrapper = mount(PrivacyView, { global: { plugins: [pinia, router] }, attachTo: document.body });
  return { w: wrapper, router, fetch };
}

const headings = (w: VueWrapper) => w.findAll('h1, h2').map((h) => `${h.element.tagName} ${h.text()}`);

describe('PrivacyView (UC-01 step 2, TC-B1-USER-01p)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('opens signed out, with no API call', async () => {
    const { w, router, fetch } = await render();
    expect(router.currentRoute.value.name).toBe('privacy');
    expect(w.get('h1').text()).toBe('Quyền riêng tư');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('states what is stored, how long, the deletion grace period, backups and AI, in Vietnamese', async () => {
    const { w } = await render();
    expect(headings(w)).toEqual(['H1 Quyền riêng tư', 'H2 Chúng tôi lưu gì', 'H2 Lưu bao lâu', 'H2 Xuất hoặc xóa dữ liệu', 'H2 Bản sao lưu', 'H2 AI']);
    const stored = w.findAll('[data-test="stored"] li').map((li) => li.text());
    for (const start of ['Tài khoản:', 'Câu trả lời khi bắt đầu:', 'Bảng điểm:', 'Lộ trình:', 'Phiên đăng nhập:', 'Số lần dùng AI:']) {
      expect(stored.some((item) => item.startsWith(start)), start).toBe(true);
    }
    expect(stored[0]).toContain('thời điểm bạn đồng ý');
    const text = w.text();
    expect(text).toContain('Đến khi bạn xóa tài khoản.');
    expect(text).toContain('Sau 30 ngày');
    expect(text).toContain('Đăng nhập lại trước hạn đó sẽ hủy việc xóa.');
    expect(text).toContain('14 bản gần nhất');
    expect(text).toContain('giữ 7 ngày');
    expect(text).toContain('Không bao giờ gửi tên, email hay mã số sinh viên.');
    expect(text).toContain('không bao giờ hỏi hay lưu mật khẩu cổng thông tin');
    expect(text).toContain('Cập nhật ngày 12/11/2026.');
  });

  it('names the Settings labels the student will see to export or delete', async () => {
    const { w } = await render();
    expect(w.get('[data-test="export"]').text()).toContain('Cài đặt → Dữ liệu của bạn → Xuất dữ liệu');
    expect(w.get('[data-test="delete"]').text()).toContain('Cài đặt → Dữ liệu của bạn → Xóa tài khoản');
  });

  it('switches every heading and sentence, and the tab title, to English', async () => {
    const { w } = await render();
    expect(document.title).toBe('Quyền riêng tư · OmniCourse');
    useLocale().set('en');
    await nextTick();
    expect(headings(w)).toEqual(['H1 Privacy notice', 'H2 What we store', 'H2 How long we keep it', 'H2 Export or delete your data', 'H2 Backups', 'H2 AI']);
    expect(document.title).toBe('Privacy notice · OmniCourse');
    expect(document.documentElement.lang).toBe('en');
    const text = w.text();
    expect(text).not.toMatch(/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i);
    expect(text).toContain('Until you delete your account.');
    expect(text).toContain('After 30 days');
    expect(text).toContain('Signing in again before then cancels the deletion.');
    expect(text).toContain('AI usage counts');
    expect(text).toContain('Never what you asked or what the AI answered.');
    expect(text).toContain('Last updated 12 Nov 2026.');
    expect(w.get('[data-test="export"]').text()).toContain('Settings → Your data → Export data');
    expect(w.get('[data-test="delete"]').text()).toContain('Settings → Your data → Delete account');
  });

  it('opens for a signed-in student too', async () => {
    const { router } = await render(true);
    expect(router.currentRoute.value.fullPath).toBe('/privacy');
  });
});
