import type { RequirementGroupKind } from '../curriculum/api.js';
import type { Lang } from '../locale.js';

interface ExplorerMessages {
  title: string;
  summary: (courses: number, credits: number | null) => string;
  program: string;
  cohort: string;
  cohortOption: (year: number) => string;
  search: string;
  searchPlaceholder: string;
  filter: string;
  all: string;
  courses: (n: number) => string;
  rule: (kind: RequirementGroupKind, total: number | null, min: number | null) => string;
  kinds: Record<RequirementGroupKind, string>;
  credits: (n: number) => string;
  inTranscript: string;
  inTranscriptNote: string;
  noMatch: string;
  noMatchHint: string;
  loading: string;
  loadFailed: string;
  noCurriculum: string;
  retry: string;
  close: string;
  code: string;
  creditsLabel: string;
  periods: string;
  periodKinds: { theory: string; lab: string; exercise: string; project: string };
  memberships: string;
  membershipsFailed: string;
  noPrerequisites: string;
  source: string;
}

export const EXPLORER_MESSAGES: Record<Lang, ExplorerMessages> = {
  vi: {
    title: 'Chương trình đào tạo',
    summary: (courses, credits) => `${courses} học phần` + (credits === null ? '' : ` · ${credits} TC để tốt nghiệp`),
    program: 'Chương trình',
    cohort: 'Khóa',
    cohortOption: (year) => `Khóa ${year}`,
    search: 'Tìm học phần',
    searchPlaceholder: 'Mã hoặc tên môn, ví dụ hoc may',
    filter: 'Lọc theo nhóm',
    all: 'Tất cả',
    courses: (n) => `${n} học phần`,
    rule: (kind, total, min) =>
      kind === 'compulsory' ? (total === null ? 'Bắt buộc' : `Bắt buộc · ${total} TC`) : min === null ? 'Tự chọn' : `Tự chọn · tối thiểu ${min} TC`,
    kinds: { compulsory: 'bắt buộc', elective: 'tự chọn' },
    credits: (n) => `${n} TC`,
    inTranscript: 'Trong bảng điểm',
    inTranscriptNote: 'Môn này có trong bảng điểm bạn đã lưu. Việc môn này được tính hay chưa sẽ do phần xét tốt nghiệp quyết định.',
    noMatch: 'Không có học phần nào khớp.',
    noMatchHint: 'Thử mã môn hoặc bỏ lọc nhóm.',
    loading: 'Đang tải chương trình…',
    loadFailed: 'Chưa tải được chương trình đào tạo.',
    noCurriculum: 'Chưa có chương trình đào tạo cho khóa này.',
    retry: 'Thử lại',
    close: 'Đóng',
    code: 'Mã học phần',
    creditsLabel: 'Tín chỉ',
    periods: 'Số tiết',
    periodKinds: { theory: 'LT', lab: 'TH', exercise: 'BT', project: 'ĐT' },
    memberships: 'Thuộc nhóm',
    membershipsFailed: 'Chưa tải được các nhóm của môn này.',
    noPrerequisites: 'Chưa ghi nhận môn tiên quyết và học kỳ mở môn.',
    source: 'Dữ liệu CTĐT nhập theo văn bản gốc của trường, không do AI trích xuất.',
  },
  en: {
    title: 'Curriculum',
    summary: (courses, credits) => `${courses} courses` + (credits === null ? '' : ` · ${credits} credits to graduate`),
    program: 'Program',
    cohort: 'Cohort',
    cohortOption: (year) => `Cohort ${year}`,
    search: 'Search courses',
    searchPlaceholder: 'A code or a name, e.g. hoc may',
    filter: 'Filter by group',
    all: 'All',
    courses: (n) => `${n} courses`,
    rule: (kind, total, min) =>
      kind === 'compulsory' ? (total === null ? 'Compulsory' : `Compulsory · ${total} credits`) : min === null ? 'Elective' : `Elective · at least ${min} credits`,
    kinds: { compulsory: 'compulsory', elective: 'elective' },
    credits: (n) => `${n} cr`,
    inTranscript: 'In your transcript',
    inTranscriptNote: 'This course is in the transcript you saved. Whether it counts is for the degree audit to decide.',
    noMatch: 'No course matches.',
    noMatchHint: 'Try a course code, or clear the group filter.',
    loading: 'Loading the curriculum…',
    loadFailed: 'The curriculum could not be loaded.',
    noCurriculum: 'There is no curriculum for this cohort yet.',
    retry: 'Try again',
    close: 'Close',
    code: 'Course code',
    creditsLabel: 'Credits',
    periods: 'Periods',
    periodKinds: { theory: 'Lecture', lab: 'Lab', exercise: 'Exercise', project: 'Project' },
    memberships: 'In groups',
    membershipsFailed: 'The groups of this course could not be loaded.',
    noPrerequisites: 'Prerequisites and offering terms are not recorded yet.',
    source: 'Curriculum data is entered from the school’s official documents, not extracted by AI.',
  },
};
