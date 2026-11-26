import type { AcademicCalendar, CalendarEvent } from '../api.js';

// Synthetic school dates (no real announcement): academic year 2026, term 1 starting Monday 7 September.

const base: Omit<CalendarEvent, 'id' | 'kind' | 'startsOn' | 'endsOn' | 'title'> = {
  academicYear: 2026,
  term: 1,
  titleEn: null,
  sourceUrl: null,
  notes: null,
  updatedAt: '2026-11-01T02:00:00.000Z',
};

export const event = (fields: Partial<CalendarEvent> & Pick<CalendarEvent, 'id' | 'kind' | 'startsOn' | 'title'>): CalendarEvent => ({
  ...base,
  endsOn: fields.startsOn,
  ...fields,
});

export const TERM_START = event({ id: 'e-start', kind: 'term_start', startsOn: '2026-09-07', title: 'Bắt đầu học kỳ 1', titleEn: 'Term 1 starts' });
export const ADD_DROP = event({ id: 'e-adddrop', kind: 'add_drop', startsOn: '2026-09-14', endsOn: '2026-09-18', title: 'Điều chỉnh đăng ký HK1' });
export const REGISTRATION = event({
  id: 'e-reg',
  kind: 'registration',
  term: 2,
  startsOn: '2026-11-10',
  endsOn: '2026-11-20',
  title: 'Đăng ký học phần học kỳ 2',
  titleEn: 'Term 2 course registration',
  sourceUrl: 'https://example.edu.vn/thong-bao/dang-ky-hk2',
  notes: 'Đăng ký trên cổng.\nKiểm tra lịch thi trước.',
});
export const HOLIDAY = event({ id: 'e-holiday', kind: 'holiday', term: null, startsOn: '2026-11-20', title: 'Nghỉ ngày Nhà giáo Việt Nam' });
export const EXAMS = event({ id: 'e-exams', kind: 'exam_period', startsOn: '2026-12-21', endsOn: '2027-01-03', title: 'Thi cuối kỳ HK1' });
export const TERM_END = event({ id: 'e-end', kind: 'term_end', startsOn: '2027-01-10', title: 'Kết thúc học kỳ 1' });

export const PROGRAM = { id: '00000000-0000-4000-8000-000000000001', code: 'ZZPROG', nameVi: 'Chương trình thử', nameEn: null };

export const calendar = (events: CalendarEvent[] = [TERM_START, ADD_DROP, REGISTRATION, HOLIDAY, EXAMS, TERM_END]): AcademicCalendar => ({ program: PROGRAM, events });
