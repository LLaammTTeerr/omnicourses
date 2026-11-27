import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterView } from 'vue-router';
import { ADD_DROP, HOLIDAY, PROGRAM, REGISTRATION, TERM_START, calendar, event } from '../calendar/testing/fixtures.js';
import { useLocale } from '../locale.js';
import { useToast } from '../shell/toast.js';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { chooseOption, optionsOf } from '../testing/select.js';
import { setup } from '../testing/signed-in.js';
import type { AcademicCalendar, CalendarEvent, UserGrants } from './api.js';
import { ADMIN_MESSAGES } from './messages.js';
import { useAdminAccess } from './store.js';
import { adminPrograms, grants, OTHER_PROGRAM_ID, PROGRAM_ID, programGrant } from './testing/fixtures.js';

const EVENTS_PATH = `/admin/programs/${PROGRAM_ID}/calendar-events`;
const BOTH_PROGRAMS = grants({ programs: [programGrant({ programId: OTHER_PROGRAM_ID, programCode: 'ZZEMPTY' }), programGrant()] });
const NO_PROGRAM_PERMISSION = status(403, { statusCode: 403, code: 'permission_required', permission: 'program_admin', message: 'This needs the program_admin permission' });
const lost = () => {
  throw new TypeError('Failed to fetch');
};

let wrapper: VueWrapper | undefined;
let savedByProgram: Record<string, AcademicCalendar>;
let own: UserGrants;

async function render(routes: Record<string, unknown> = {}, selectProgram = true) {
  let lastUrl = '';
  const baseFetch = mockApi({
    'GET /admin/grants': () => Response.json(own),
    'GET /admin/programs': adminPrograms(),
    'GET /academic-calendar': () => {
      const code = new URL(lastUrl).searchParams.get('program') ?? 'ZZEMPTY';
      return Response.json(savedByProgram[code] ?? { program: { ...PROGRAM, code }, events: [] });
    },
    ...routes,
  });
  const orig = baseFetch.getMockImplementation()!;
  baseFetch.mockImplementation((input, init) => {
    lastUrl = String(input);
    return orig(input, init);
  });

  const app = await setup('/admin');
  await app.router.push('/admin/calendar');
  wrapper = mount(RouterView, { global: { plugins: [app.pinia, app.router] }, attachTo: document.body });
  await flushPromises();
  if (selectProgram) {
    await chooseOption(wrapper.get('[data-test="admin-program"]'), 'ZZPROG · Chương trình thử');
    await flushPromises();
  }
  return { w: wrapper, fetch: baseFetch, ...app };
}

type Scope = Pick<DOMWrapper<Element>, 'get'>;
const get = (w: Scope, test: string) => w.get(`[data-test="${test}"]`);
const has = (w: VueWrapper, test: string) => w.find(`[data-test="${test}"]`).exists();
const eventRow = (w: VueWrapper, id: string) => w.get(`[data-test="event-row"][data-event-id="${id}"]`);
const calls = (fetch: ReturnType<typeof mockApi>, method: string) => fetch.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method);
const submit = async (w: VueWrapper) => {
  await w.get('dialog[open] form').trigger('submit');
  await flushPromises();
};

describe('CalendarAdmin (F10): school calendar administration for a program administrator', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    own = BOTH_PROGRAMS;
    savedByProgram = {
      ZZEMPTY: { program: { id: OTHER_PROGRAM_ID, code: 'ZZEMPTY', nameVi: 'Chương trình thử chưa có khóa', nameEn: null }, events: [] },
      ZZPROG: calendar([TERM_START, ADD_DROP, REGISTRATION, HOLIDAY]),
    };
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('picks an editable program and lists its school dates (term, add_drop, registration, holiday) in Vietnamese and English', async () => {
    const { w, fetch } = await render({}, false);
    expect(optionsOf(get(w, 'admin-program'))).toEqual(['ZZEMPTY · Chương trình thử chưa có khóa', 'ZZPROG · Chương trình thử']);
    expect(get(w, 'admin-program').element.closest('label')).toBeNull();
    expect(get(w, 'no-events').text()).toBe(ADMIN_MESSAGES.vi.calendar.noEvents);

    await chooseOption(get(w, 'admin-program'), 'ZZPROG · Chương trình thử');
    await flushPromises();
    expect(fetch.mock.calls.map(([url]) => String(url))).toContainEqual(expect.stringContaining('/academic-calendar?program=ZZPROG'));
    expect(get(w, 'events-title').text()).toBe('4 mốc lịch năm học');

    expect(get(eventRow(w, TERM_START.id), 'event-kind').text()).toBe('Bắt đầu học kỳ');
    expect(get(eventRow(w, TERM_START.id), 'event-term').text()).toBe('HK1 · 2026–2027');
    expect(get(eventRow(w, ADD_DROP.id), 'event-kind').text()).toBe('Điều chỉnh đăng ký');
    expect(get(eventRow(w, REGISTRATION.id), 'event-kind').text()).toBe('Đăng ký học phần');
    expect(get(eventRow(w, REGISTRATION.id), 'event-term').text()).toBe('HK2 · 2026–2027');
    expect(get(eventRow(w, REGISTRATION.id), 'event-notes').text()).toContain('Đăng ký trên cổng.');
    expect(get(eventRow(w, REGISTRATION.id), 'event-source').attributes('href')).toBe('https://example.edu.vn/thong-bao/dang-ky-hk2');
    expect(get(eventRow(w, HOLIDAY.id), 'event-term').text()).toBe('Cả năm 2026–2027');

    useLocale().set('en');
    await flushPromises();
    expect(get(w, 'events-title').text()).toBe('4 school dates');
    expect(eventRow(w, REGISTRATION.id).text()).toContain('Term 2 course registration');
    expect(get(eventRow(w, REGISTRATION.id), 'event-kind').text()).toBe('Course registration');
    expect(get(eventRow(w, ADD_DROP.id), 'event-kind').text()).toBe('Add and drop');
    expect(get(eventRow(w, HOLIDAY.id), 'event-term').text()).toBe('Whole year 2026–2027');
  });

  it('creates a new calendar event, reloads the saved list, shows a toast, and restores focus', async () => {
    const created: CalendarEvent = event({
      id: 'e-new',
      academicYear: 2026,
      term: 1,
      kind: 'registration',
      startsOn: '2026-08-20',
      endsOn: '2026-08-25',
      title: 'Đăng ký học phần HK1',
      titleEn: 'Term 1 registration',
      sourceUrl: 'https://example.edu.vn/hk1',
      notes: 'Theo thông báo phòng đào tạo',
    });
    const { w, fetch } = await render({
      [`POST ${EVENTS_PATH}`]: () => {
        savedByProgram.ZZPROG = calendar([created, ...savedByProgram.ZZPROG!.events]);
        return Response.json(created, { status: 201 });
      },
    });
    const add = get(w, 'add-event');
    (add.element as HTMLElement).focus();
    await add.trigger('click');
    await flushPromises();

    const dialog = w.get('dialog[open]');
    expect(dialog.get('h2').text()).toBe(ADMIN_MESSAGES.vi.calendar.dialogNew);
    await get(dialog, 'event-title').setValue('  Đăng ký học phần HK1 ');
    await get(dialog, 'event-titleEn').setValue(' Term 1 registration ');
    await get(dialog, 'event-kind-input').setValue('registration');
    await get(dialog, 'event-term-input').setValue('1');
    await get(dialog, 'event-academicYear').setValue('2026');
    await get(dialog, 'event-startsOn').setValue('2026-08-20');
    await get(dialog, 'event-endsOn').setValue('2026-08-25');
    await get(dialog, 'event-sourceUrl').setValue('https://example.edu.vn/hk1');
    await get(dialog, 'event-notes-input').setValue('Theo thông báo phòng đào tạo');
    await submit(w);

    expect(sentBody(calls(fetch, 'POST')[0]![1])).toEqual({
      academicYear: 2026,
      term: 1,
      kind: 'registration',
      startsOn: '2026-08-20',
      endsOn: '2026-08-25',
      title: 'Đăng ký học phần HK1',
      titleEn: 'Term 1 registration',
      sourceUrl: 'https://example.edu.vn/hk1',
      notes: 'Theo thông báo phòng đào tạo',
    });
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(useToast().message).toBe('Đã thêm mốc lịch “Đăng ký học phần HK1”.');
    expect(get(w, 'events-title').text()).toBe('5 mốc lịch năm học');
    expect(eventRow(w, 'e-new').text()).toContain('Đăng ký học phần HK1');
    expect(document.activeElement).toBe(add.element);
  });

  it('shows server validation errors per field and records permission_required refusals via admin/write.ts', async () => {
    const { w, fetch, pinia } = await render({
      [`POST ${EVENTS_PATH}`]: status(400, {
        statusCode: 400,
        code: 'validation_failed',
        message: [
          'title should not be empty',
          'kind must be one of the following values: term_start, term_end, registration, add_drop, exam_period, holiday, other',
          'endsOn: 2026-08-01 is before startsOn 2026-08-10',
        ],
      }),
      [`PATCH ${EVENTS_PATH}/${ADD_DROP.id}`]: NO_PROGRAM_PERMISSION,
    });

    await get(w, 'add-event').trigger('click');
    await flushPromises();
    await submit(w);

    expect(sentBody(calls(fetch, 'POST')[0]![1])).toEqual({
      academicYear: null,
      term: null,
      kind: null,
      startsOn: '',
      title: '',
      titleEn: null,
      sourceUrl: null,
      notes: null,
    });
    const dialog = w.get('dialog[open]');
    expect(dialog.get('[data-test="admin-problem"]').attributes('data-code')).toBe('validation_failed');
    expect(get(dialog, 'event-title').attributes('aria-invalid')).toBe('true');
    expect(dialog.get('#calendar-title-error').text()).toContain('title should not be empty');
    expect(get(dialog, 'event-endsOn').attributes('aria-invalid')).toBe('true');
    expect(dialog.get('#calendar-endsOn-error').text()).toContain('endsOn: 2026-08-01 is before startsOn 2026-08-10');
    await get(dialog, 'dialog-cancel').trigger('click');
    await flushPromises();

    await get(eventRow(w, ADD_DROP.id), 'event-edit').trigger('click');
    await flushPromises();
    await get(w.get('dialog[open]'), 'event-title').setValue('Điều chỉnh mới');
    await submit(w);
    expect(useAdminAccess(pinia).refusal).toEqual({ permission: 'program_admin' });
    expect(has(w, 'admin-refused')).toBe(true);
  });

  it('updates only changed fields of an event, and sends nothing when nothing changed', async () => {
    const updated: CalendarEvent = { ...ADD_DROP, endsOn: '2026-09-19', notes: 'Mở thêm 1 ngày' };
    const { w, fetch } = await render({
      [`PATCH ${EVENTS_PATH}/${ADD_DROP.id}`]: () => {
        savedByProgram.ZZPROG = calendar(savedByProgram.ZZPROG!.events.map((e) => (e.id === ADD_DROP.id ? updated : e)));
        return Response.json(updated);
      },
    });

    await get(eventRow(w, ADD_DROP.id), 'event-edit').trigger('click');
    await flushPromises();
    await submit(w);
    expect(calls(fetch, 'PATCH')).toHaveLength(0);
    expect(useToast().message).toBe(ADMIN_MESSAGES.vi.calendar.noChange);

    await get(eventRow(w, ADD_DROP.id), 'event-edit').trigger('click');
    await flushPromises();
    const dialog = w.get('dialog[open]');
    await get(dialog, 'event-endsOn').setValue('2026-09-19');
    await get(dialog, 'event-notes-input').setValue('Mở thêm 1 ngày');
    await submit(w);

    expect(sentBody(calls(fetch, 'PATCH')[0]![1])).toEqual({ endsOn: '2026-09-19', notes: 'Mở thêm 1 ngày' });
    expect(useToast().message).toBe(`Đã lưu mốc lịch “${ADD_DROP.title}”.`);
    expect(get(eventRow(w, ADD_DROP.id), 'event-notes').text()).toBe('Mở thêm 1 ngày');
  });

  it('asks for ModalDialog confirmation before deleting an event, and settles a lost answer by reloading', async () => {
    let deleteCall = 0;
    const { w, fetch } = await render({
      [`DELETE ${EVENTS_PATH}/${HOLIDAY.id}`]: () => {
        savedByProgram.ZZPROG = calendar(savedByProgram.ZZPROG!.events.filter((e) => e.id !== HOLIDAY.id));
        return new Response(null, { status: 204 });
      },
      [`DELETE ${EVENTS_PATH}/${TERM_START.id}`]: () => {
        deleteCall++;
        savedByProgram.ZZPROG = calendar(savedByProgram.ZZPROG!.events.filter((e) => e.id !== TERM_START.id));
        return lost();
      },
    });

    await get(eventRow(w, HOLIDAY.id), 'event-delete').trigger('click');
    await flushPromises();
    const confirm = w.get('dialog[open][role="alertdialog"]');
    expect(confirm.text()).toContain(HOLIDAY.title);
    await get(confirm, 'confirm-no').trigger('click');
    await flushPromises();
    expect(calls(fetch, 'DELETE')).toHaveLength(0);

    await get(eventRow(w, HOLIDAY.id), 'event-delete').trigger('click');
    await flushPromises();
    await get(w.get('dialog[open]'), 'confirm-yes').trigger('click');
    await flushPromises();
    expect(calls(fetch, 'DELETE')).toHaveLength(1);
    expect(useToast().message).toBe(`Đã xóa mốc lịch “${HOLIDAY.title}”.`);
    expect(w.find(`[data-test="event-row"][data-event-id="${HOLIDAY.id}"]`).exists()).toBe(false);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    await get(eventRow(w, TERM_START.id), 'event-delete').trigger('click');
    await flushPromises();
    await get(w.get('dialog[open]'), 'confirm-yes').trigger('click');
    await flushPromises();
    expect(deleteCall).toBe(1);
    expect(get(w, 'admin-notice').text()).toBe(ADMIN_MESSAGES.vi.problem.confirmed);
    useLocale().set('en');
    await flushPromises();
    expect(get(w, 'admin-notice').text()).toBe(ADMIN_MESSAGES.en.problem.confirmed);
    expect(w.find(`[data-test="event-row"][data-event-id="${TERM_START.id}"]`).exists()).toBe(false);
  });
});
