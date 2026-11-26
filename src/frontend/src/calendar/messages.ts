import type { Lang } from '../locale.js';
import type { CalendarEventKind } from './api.js';
import { weekday } from './dates.js';

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
  spokenWeekdays: readonly string[];
  day: (iso: string) => string;
  longDay: (iso: string) => string;
  spokenDay: (iso: string) => string;
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
  moreLabel: (n: number, iso: string) => string;
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
const VI_SPOKEN_WEEKDAYS = ['thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy', 'Chủ nhật'];
const EN_SPOKEN_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const EN_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SHORT_MONTH_LENGTH = 3;
const enMonth = (iso: string) => EN_MONTHS[Number(parts(iso)[1]) - 1]!;
const enMonthShort = (iso: string) => enMonth(iso).slice(0, SHORT_MONTH_LENGTH);
const viLongDay = (iso: string) => `${VI_WEEKDAYS[weekday(iso)]}, ${pad(parts(iso)[2])}/${pad(parts(iso)[1])}/${parts(iso)[0]}`;
const viSpokenDay = (iso: string) => `${VI_SPOKEN_WEEKDAYS[weekday(iso)]}, ${pad(parts(iso)[2])}/${pad(parts(iso)[1])}/${parts(iso)[0]}`;
const enLongDay = (iso: string) => `${EN_WEEKDAYS[weekday(iso)]}, ${Number(parts(iso)[2])} ${enMonthShort(iso)} ${parts(iso)[0]}`;

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
    spokenWeekdays: VI_SPOKEN_WEEKDAYS,
    day: (iso) => `${Number(parts(iso)[2])}/${Number(parts(iso)[1])}`,
    longDay: viLongDay,
    spokenDay: viSpokenDay,
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
    moreLabel: (n, iso) => `${n} mốc khác vào ${viSpokenDay(iso)}, mở tuần đó`,
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
    spokenWeekdays: EN_SPOKEN_WEEKDAYS,
    day: (iso) => `${Number(parts(iso)[2])} ${enMonthShort(iso)}`,
    longDay: enLongDay,
    spokenDay: enLongDay,
    monthName: (iso) => `${enMonth(iso)} ${parts(iso)[0]}`,
    monthShort: enMonthShort,
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
    moreLabel: (n, iso) => `${n} more ${n === 1 ? 'date' : 'dates'} on ${enLongDay(iso)}, open that week`,
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
