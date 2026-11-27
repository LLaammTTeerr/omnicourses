import { type Lang } from '../../locale.js';
import { type CalendarEventKind } from '../api.js';
import type { CalendarEventField } from '../forms.js';

export interface CalendarAdminMessages {
  heading: string;
  program: string;
  lead: string;
  programsFailed: string;
  noPrograms: string;
  loadFailed: string;
  eventsTitle: (count: number) => string;
  addEvent: string;
  noEvents: string;
  columns: { title: string; kind: string; term: string; dates: string; actions: string };
  kinds: Record<CalendarEventKind, string>;
  pickKind: string;
  term: (number: number, year: number) => string;
  wholeYear: (year: number) => string;
  wholeYearOption: string;
  termOption: (number: number) => string;
  sourceLink: string;
  edit: string;
  editLabel: (title: string) => string;
  delete: string;
  deleteLabel: (title: string) => string;
  dialogNew: string;
  dialogEdit: (title: string) => string;
  fields: Record<CalendarEventField, string>;
  academicYearHint: string;
  endsOnHint: string;
  titleHint: string;
  titleEnHint: string;
  sourceUrlHint: string;
  notesHint: string;
  created: (title: string) => string;
  saved: (title: string) => string;
  deleted: (title: string) => string;
  noChange: string;
  deleteTitle: string;
  deleteBody: (title: string, program: string) => string;
}

export const CALENDAR_MESSAGES: Record<Lang, CalendarAdminMessages> = {
  vi: {
    heading: 'Lịch năm học của chương trình',
    program: 'Chương trình',
    lead: 'Nhập ngày học kỳ, đăng ký học phần, điều chỉnh đăng ký, thi và nghỉ từ thông báo chính thức của trường.',
    programsFailed: 'Chưa tải được các chương trình bạn quản trị.',
    noPrograms: 'Bạn chưa được cấp quyền quản trị chương trình nào.',
    loadFailed: 'Chưa tải được lịch năm học của chương trình này.',
    eventsTitle: (count) => `${count} mốc lịch năm học`,
    addEvent: 'Thêm mốc lịch',
    noEvents: 'Chương trình này chưa có mốc lịch năm học nào.',
    columns: { title: 'Mốc lịch', kind: 'Loại', term: 'Học kỳ', dates: 'Thời gian', actions: 'Thao tác' },
    kinds: {
      term_start: 'Bắt đầu học kỳ',
      term_end: 'Kết thúc học kỳ',
      registration: 'Đăng ký học phần',
      add_drop: 'Điều chỉnh đăng ký',
      exam_period: 'Thi',
      holiday: 'Nghỉ',
      other: 'Mốc khác',
    },
    pickKind: 'Chọn loại mốc lịch',
    term: (number, year) => `HK${number} · ${year}–${year + 1}`,
    wholeYear: (year) => `Cả năm ${year}–${year + 1}`,
    wholeYearOption: 'Cả năm học',
    termOption: (number) => `Học kỳ ${number}`,
    sourceLink: 'Thông báo của trường',
    edit: 'Sửa',
    editLabel: (title) => `Sửa mốc lịch ${title}`,
    delete: 'Xóa',
    deleteLabel: (title) => `Xóa mốc lịch ${title}`,
    dialogNew: 'Mốc lịch mới',
    dialogEdit: (title) => `Sửa mốc lịch ${title}`,
    fields: {
      academicYear: 'Năm học bắt đầu',
      term: 'Học kỳ',
      kind: 'Loại mốc lịch',
      startsOn: 'Ngày bắt đầu',
      endsOn: 'Ngày kết thúc',
      title: 'Tiêu đề tiếng Việt',
      titleEn: 'Tiêu đề tiếng Anh',
      sourceUrl: 'Liên kết thông báo (https)',
      notes: 'Ghi chú',
    },
    academicYearHint: 'Ví dụ 2026 nghĩa là năm học 2026–2027. Ngày bắt đầu phải thuộc năm 2026 hoặc 2027.',
    endsOnHint: 'Để trống nếu mốc lịch chỉ diễn ra trong một ngày.',
    titleHint: 'Ghi đúng tiêu đề trên thông báo của trường.',
    titleEnHint: 'Để trống nếu thông báo không có bản tiếng Anh.',
    sourceUrlHint: 'Liên kết https:// tới thông báo chính thức của trường. Để trống nếu chưa có.',
    notesHint: 'Ghi chú thêm cho sinh viên nếu cần. Để trống nếu không có.',
    created: (title) => `Đã thêm mốc lịch “${title}”.`,
    saved: (title) => `Đã lưu mốc lịch “${title}”.`,
    deleted: (title) => `Đã xóa mốc lịch “${title}”.`,
    noChange: 'Không có gì thay đổi, nên chưa gửi gì.',
    deleteTitle: 'Xóa mốc lịch này?',
    deleteBody: (title, program) => `Mốc lịch “${title}” sẽ bị xóa khỏi lịch năm học của chương trình ${program}.`,
  },
  en: {
    heading: 'School calendar of a program',
    program: 'Program',
    lead: "Enter term, registration, add/drop, exam and holiday dates from the school's official announcements.",
    programsFailed: 'Could not load the programs you administer.',
    noPrograms: 'You hold no program administrator grant.',
    loadFailed: 'Could not load the school calendar of this program.',
    eventsTitle: (count) => (count === 1 ? '1 school date' : `${count} school dates`),
    addEvent: 'Add school date',
    noEvents: 'This program has no school dates yet.',
    columns: { title: 'School date', kind: 'Kind', term: 'Term', dates: 'Dates', actions: 'Actions' },
    kinds: {
      term_start: 'Term starts',
      term_end: 'Term ends',
      registration: 'Course registration',
      add_drop: 'Add and drop',
      exam_period: 'Exams',
      holiday: 'Holiday',
      other: 'Other',
    },
    pickKind: 'Choose a kind',
    term: (number, year) => `Term ${number} · ${year}–${year + 1}`,
    wholeYear: (year) => `Whole year ${year}–${year + 1}`,
    wholeYearOption: 'Whole academic year',
    termOption: (number) => `Term ${number}`,
    sourceLink: 'School announcement',
    edit: 'Edit',
    editLabel: (title) => `Edit the school date ${title}`,
    delete: 'Delete',
    deleteLabel: (title) => `Delete the school date ${title}`,
    dialogNew: 'New school date',
    dialogEdit: (title) => `Edit the school date ${title}`,
    fields: {
      academicYear: 'Academic year start',
      term: 'Term',
      kind: 'Kind',
      startsOn: 'First day',
      endsOn: 'Last day',
      title: 'Vietnamese title',
      titleEn: 'English title',
      sourceUrl: 'Announcement link (https)',
      notes: 'Notes',
    },
    academicYearHint: 'For example 2026 means the academic year 2026–2027. The first day must fall in 2026 or 2027.',
    endsOnHint: 'Leave empty for a one-day date.',
    titleHint: 'Enter the title as the school announcement words it.',
    titleEnHint: 'Leave empty when the announcement gives no English title.',
    sourceUrlHint: 'An https:// link to the official school announcement. Leave empty if none.',
    notesHint: 'Optional notes for students. Leave empty if none.',
    created: (title) => `Added the school date “${title}”.`,
    saved: (title) => `Saved the school date “${title}”.`,
    deleted: (title) => `Deleted the school date “${title}”.`,
    noChange: 'Nothing changed, so nothing was sent.',
    deleteTitle: 'Delete this school date?',
    deleteBody: (title, program) => `The school date “${title}” will be deleted from the school calendar of ${program}.`,
  },
};
