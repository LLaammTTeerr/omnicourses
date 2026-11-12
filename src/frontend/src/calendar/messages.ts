import type { Lang } from '../locale.js';
import type { CalendarEventKind } from './api.js';

interface CalendarMessages {
  title: string;
  view: string;
  week: string;
  month: string;
  pickWeek: string;
  pickMonth: string;
  today: string;
  previous: string;
  next: string;
  now: string;
  weekNumber: (n: number) => string;
  weekdays: readonly string[];
  /** "20/7" or "20 Jul". */
  day: (iso: string) => string;
  /** "T2, 20/07/2026" or "Mon, 20 Jul 2026". */
  longDay: (iso: string) => string;
  monthName: (iso: string) => string;
  monthShort: (iso: string) => string;
  days: (n: number) => string;
  kinds: Record<CalendarEventKind, string>;
  term: (n: 1 | 2 | 3, year: number) => string;
  wholeYear: (year: number) => string;
  termShort: (n: 1 | 2 | 3) => string;
  academicYear: (year: number) => string;
  upcoming: string;
  ongoing: string;
  noDates: string;
  noDatesText: string;
  noUpcoming: string;
  noProgram: string;
  finishOnboarding: string;
  more: (n: number) => string;
  close: string;
  when: string;
  termLabel: string;
  notes: string;
  source: string;
  sourceLink: string;
  updated: string;
  foot: (program: string) => string;
  loading: string;
  loadFailed: string;
  retry: string;
}

const pad = (n: string) => n.padStart(2, '0');
const parts = (iso: string) => iso.split('-') as [string, string, string];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const VI_WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const EN_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dow = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;

export const CALENDAR_MESSAGES: Record<Lang, CalendarMessages> = {
  vi: {
    title: 'Lịch',
    view: 'Kiểu xem',
    week: 'Tuần',
    month: 'Tháng',
    pickWeek: 'Chọn tuần',
    pickMonth: 'Chọn tháng',
    today: 'Hôm nay',
    previous: 'Trước',
    next: 'Sau',
    now: 'nay',
    weekNumber: (n) => `Tuần ${n}`,
    weekdays: VI_WEEKDAYS,
    day: (iso) => `${Number(parts(iso)[2])}/${Number(parts(iso)[1])}`,
    longDay: (iso) => `${VI_WEEKDAYS[dow(iso)]}, ${pad(parts(iso)[2])}/${pad(parts(iso)[1])}/${parts(iso)[0]}`,
    monthName: (iso) => `Tháng ${Number(parts(iso)[1])}, ${parts(iso)[0]}`,
    monthShort: (iso) => `Th${Number(parts(iso)[1])}`,
    days: (n) => `${n} ngày`,
    kinds: {
      term_start: 'Bắt đầu học kỳ',
      term_end: 'Kết thúc học kỳ',
      registration: 'Đăng ký học phần',
      add_drop: 'Điều chỉnh đăng ký',
      exam_period: 'Thi',
      holiday: 'Nghỉ',
      other: 'Mốc khác',
    },
    term: (n, year) => `Học kỳ ${n}, ${year}–${year + 1}`,
    wholeYear: (year) => `Cả năm học ${year}–${year + 1}`,
    termShort: (n) => `HK${n}`,
    academicYear: (year) => `Năm học ${year}–${year + 1}`,
    upcoming: 'Sắp tới',
    ongoing: 'Đang diễn ra',
    noDates: 'Chưa có lịch của trường',
    noDatesText: 'Ngày học kỳ, đăng ký, thi và nghỉ sẽ hiện ở đây khi quản trị chương trình nhập từ thông báo của trường.',
    noUpcoming: 'Không còn mốc nào sắp tới.',
    noProgram: 'Bạn chưa chọn chương trình, nên chưa có lịch của trường để hiện.',
    finishOnboarding: 'Chọn chương trình',
    more: (n) => `+${n}`,
    close: 'Đóng',
    when: 'Thời gian',
    termLabel: 'Học kỳ',
    notes: 'Ghi chú',
    source: 'Nguồn',
    sourceLink: 'Thông báo của trường',
    updated: 'Cập nhật',
    foot: (program) => `Ngày do quản trị chương trình ${program} nhập từ thông báo của trường. Xem lại nguồn trước khi làm thủ tục.`,
    loading: 'Đang tải lịch…',
    loadFailed: 'Không tải được lịch.',
    retry: 'Thử lại',
  },
  en: {
    title: 'Calendar',
    view: 'View',
    week: 'Week',
    month: 'Month',
    pickWeek: 'Pick a week',
    pickMonth: 'Pick a month',
    today: 'Today',
    previous: 'Previous',
    next: 'Next',
    now: 'now',
    weekNumber: (n) => `Week ${n}`,
    weekdays: EN_WEEKDAYS,
    day: (iso) => `${Number(parts(iso)[2])} ${EN_MONTHS[Number(parts(iso)[1]) - 1]!.slice(0, 3)}`,
    longDay: (iso) => `${EN_WEEKDAYS[dow(iso)]}, ${Number(parts(iso)[2])} ${EN_MONTHS[Number(parts(iso)[1]) - 1]!.slice(0, 3)} ${parts(iso)[0]}`,
    monthName: (iso) => `${EN_MONTHS[Number(parts(iso)[1]) - 1]} ${parts(iso)[0]}`,
    monthShort: (iso) => EN_MONTHS[Number(parts(iso)[1]) - 1]!.slice(0, 3),
    days: (n) => (n === 1 ? '1 day' : `${n} days`),
    kinds: {
      term_start: 'Term starts',
      term_end: 'Term ends',
      registration: 'Course registration',
      add_drop: 'Add and drop',
      exam_period: 'Exams',
      holiday: 'Holiday',
      other: 'Other',
    },
    term: (n, year) => `Term ${n}, ${year}–${year + 1}`,
    wholeYear: (year) => `Whole year ${year}–${year + 1}`,
    termShort: (n) => `T${n}`,
    academicYear: (year) => `Academic year ${year}–${year + 1}`,
    upcoming: 'Coming up',
    ongoing: 'Now on',
    noDates: 'No school dates yet',
    noDatesText: "Term, registration, exam and holiday dates show here once your program administrator enters them from the school's announcements.",
    noUpcoming: 'Nothing else coming up.',
    noProgram: 'You have not picked a program yet, so there are no school dates to show.',
    finishOnboarding: 'Pick a program',
    more: (n) => `+${n}`,
    close: 'Close',
    when: 'When',
    termLabel: 'Term',
    notes: 'Notes',
    source: 'Source',
    sourceLink: 'School announcement',
    updated: 'Updated',
    foot: (program) => `Dates entered by the ${program} program administrator from the school's announcements. Check the source before you act on one.`,
    loading: 'Loading the calendar…',
    loadFailed: 'The calendar could not be loaded.',
    retry: 'Try again',
  },
};
