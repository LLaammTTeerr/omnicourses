import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/store.js';
import { useLocale } from '../locale.js';
import { mockApi, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import type { DegreeAudit } from './api.js';
import DashboardView from './DashboardView.vue';
import { COMBINED, degreeAudit, emptyAudit, GROUP_A } from './testing/fixtures.js';

let wrapper: VueWrapper | undefined;

async function render(answer: unknown = degreeAudit()) {
  const fetch = mockApi({ 'GET /users/me/audit': answer });
  const app = await setup('/dashboard');
  wrapper = mount(DashboardView, { global: { plugins: [app.pinia, app.router] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, fetch, ...app };
}

const text = (w: VueWrapper, test: string) => w.get(`[data-test="${test}"]`).text();

describe('DashboardView (F3, UC-03)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('shows graduation status, credits and averages exactly as the API gives them', async () => {
    const { w, fetch } = await render();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(text(w, 'who')).toBe('APCS2024 · sinh viên năm 1');
    expect(text(w, 'graduation')).toContain('Chưa đủ điều kiện tốt nghiệp');
    expect(text(w, 'graduation')).toContain('Còn 3 điều kiện chưa đạt.');
    expect(text(w, 'credits')).toContain('8 / 20 TC');
    expect(text(w, 'credits')).toContain('còn 12 TC');
    expect(text(w, 'credits')).toContain('4 TC đang học');
    expect(text(w, 'credits')).toContain('9 TC tích lũy');
    expect(text(w, 'gpa')).toContain('8');
    expect(text(w, 'gpa')).toContain('Xếp loại: Giỏi');
    expect(text(w, 'gpa')).toContain('7,75');
    expect(w.find('[data-test="no-transcript"]').exists()).toBe(false);
  });

  it('lists each group in colour order with its progress, and never shows a group without a minimum as 0 / 0', async () => {
    const { w } = await render();
    const groups = w.findAll('[data-test="group"]');
    expect(groups.map((g) => g.get('.nm').text())).toEqual(['Kiến thức Computer Science (A): bắt buộc', 'Kiến thức Math', 'Tự chọn Computer Science (C)']);
    const [core, math, elective] = groups;
    expect(core!.classes()).toContain('g-core');
    expect(core!.text()).toContain('4 / 8 TC');
    expect(core!.text()).toContain('○ Chưa đạt');
    expect(core!.text()).toContain('còn 4 TC');
    expect(core!.get('a').attributes('href')).toBe(`/audit#group-${GROUP_A}`);
    expect(math!.text()).toContain('✓ Đã đạt');
    expect(elective!.text()).toContain('Không có tối thiểu riêng · tính trong Kiến thức tự chọn');
    expect(elective!.text()).not.toMatch(/\/ 0/);
    // The API calls it met but lists no condition for it: no ✓, its rule is the combined minimum.
    expect(elective!.text()).not.toContain('✓');
    expect(elective!.text()).not.toContain('Chưa đạt');
    expect(elective!.find('.meter').exists()).toBe(false);
    expect(text(w, 'combined')).toContain('0 / 12 TC');
    expect(text(w, 'combined')).toContain('còn 8 TC');
  });

  it('lists the unmet conditions with their citations, linked to the audit', async () => {
    const { w } = await render();
    const items = w.findAll('[data-test="unmet"] li');
    expect(items.map((li) => li.get('.nm').text())).toEqual([
      'Kiến thức Computer Science (A): bắt buộc',
      'Kiến thức tự chọn: tối thiểu 12 TC',
      'Tích lũy tối thiểu 20 TC của khóa',
    ]);
    expect(items[0]!.get('.cite').text()).toBe('QĐ 1175/QĐ-KHTN Điều 17.3.b');
    expect(items[1]!.get('a').attributes('href')).toBe(`/audit#combined-${COMBINED}`);
    expect(items[2]!.get('a').attributes('href')).toBe('/audit#graduation');
  });

  it('shows only the first five unmet conditions, and says how many more there are', async () => {
    const base = degreeAudit();
    const unmet = Array.from({ length: 7 }, (_, i) => ({ id: `zz_condition_${i}`, description: `Synthetic condition ${i}`, citation: 'QĐ 1175/QĐ-KHTN Điều 17.3.b', status: 'not_met' as const }));
    const { w } = await render(degreeAudit({ graduation: { ...base.graduation, unmet } }));
    expect(w.findAll('[data-test="unmet"] li')).toHaveLength(5);
    expect(text(w, 'unmet')).toContain('Synthetic condition 0');
    expect(text(w, 'unmet')).toContain('và 2 điều kiện khác');
  });

  it('links to the audit, the transcript, the explorer and the plans', async () => {
    const { w } = await render();
    expect(w.get('[data-test="link-audit"]').attributes('href')).toBe('/audit');
    expect(w.get('[data-test="link-transcript"]').attributes('href')).toBe('/transcript');
    expect(w.get('[data-test="link-explorer"]').attributes('href')).toBe('/explorer');
    // The app's own router: the plans route of #80, not one the test adds.
    expect(w.get('[data-test="link-planner"]').attributes('href')).toBe('/plans');
  });

  it('with no transcript, says the figures assume nothing is passed and points to the upload', async () => {
    const { w } = await render(emptyAudit());
    const note = w.get('[data-test="no-transcript"]');
    expect(note.text()).toContain('Chưa có bảng điểm.');
    expect(note.get('a').attributes('href')).toBe('/transcript');
    expect(text(w, 'credits')).toContain('0 / 20 TC');
    expect(text(w, 'gpa')).toContain('Chưa có');
    expect(w.findAll('[data-test="group"]')).toHaveLength(3);
  });

  it('says when the done status still leaves conditions for the school, never calling them met', async () => {
    const base = degreeAudit();
    const done: DegreeAudit = degreeAudit({ graduation: { ...base.graduation, status: 'done', unmet: [] } });
    const { w } = await render(done);
    expect(text(w, 'graduation')).toContain('Đạt mọi điều kiện kiểm tra được');
    expect(text(w, 'graduation')).toContain('Còn 2 điều kiện OmniCourse không kiểm tra được');
    expect(text(w, 'unmet')).toContain('Không còn điều kiện nào chưa đạt.');
  });

  it('switches to English', async () => {
    const { w } = await render();
    useLocale().set('en');
    await flushPromises();
    expect(text(w, 'credits')).toContain('8 / 20 credits');
    expect(text(w, 'gpa')).toContain('7.75');
    expect(w.get('h1').text()).toBe('Dashboard');
  });

  it('writes one condition and one credit in the singular in English', async () => {
    const base = degreeAudit();
    const notYet = degreeAudit({ graduation: { ...base.graduation, unmet: base.graduation.unmet.slice(0, 1) }, credits: { ...base.credits, towardTotal: 1, totalRequired: null } });
    const { w } = await render(notYet);
    useLocale().set('en');
    await flushPromises();
    expect(text(w, 'graduation')).toContain('1 condition not met yet.');
    expect(text(w, 'credits')).toContain('1 credit');
    expect(text(w, 'credits')).not.toContain('1 credits');
    const done = degreeAudit({ graduation: { ...base.graduation, status: 'done', unmet: [], notChecked: base.graduation.notChecked.slice(0, 1) } });
    wrapper?.unmount();
    const again = await render(done);
    useLocale().set('en');
    await flushPromises();
    expect(text(again.w, 'graduation')).toContain('1 condition OmniCourse cannot check remains for the training office.');
  });

  it('sends a student who has not finished onboarding there, with no error', async () => {
    const { w } = await render(status(409, { statusCode: 409, code: 'onboarding_required', message: 'Finish onboarding' }));
    const note = w.get('[data-test="onboarding-required"]');
    expect(note.get('a').attributes('href')).toBe('/onboarding');
    expect(w.find('[role="alert"]').exists()).toBe(false);
    expect(w.find('[data-test="group"]').exists()).toBe(false);
  });

  it('says when there is no curriculum for the program and cohort', async () => {
    const { w } = await render(status(409, { statusCode: 409, code: 'curriculum_not_found', message: 'No curriculum' }));
    expect(w.get('[data-test="curriculum-not-found"]').get('a').attributes('href')).toBe('/settings');
  });

  it('shows an error with a retry when the audit cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w, fetch } = await render(status(500));
    expect(w.get('[role="alert"]').text()).toContain('Chưa tải được kết quả xét tốt nghiệp.');
    fetch.mockImplementation(async () => Response.json(degreeAudit()));
    await w.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(w.find('[role="alert"]').exists()).toBe(false);
    expect(text(w, 'credits')).toContain('8 / 20 TC');
  });

  it('on a 401 signs the student out and shows no error of its own', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render(status(401));
    expect(useAuth().signedIn).toBe(false);
    expect(w.find('[role="alert"]').exists()).toBe(false);
    expect(w.find('[data-test="group"]').exists()).toBe(false);
  });
});
