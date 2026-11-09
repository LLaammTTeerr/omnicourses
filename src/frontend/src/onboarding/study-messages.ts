import type { Lang } from '../locale.js';

interface StudyMessages {
  title: string;
  note: string;
  program: string;
  cohort: string;
  cohortOption: (year: number) => string;
  save: string;
  saving: string;
  saved: string;
  saveFailed: string;
  loading: string;
  loadFailed: string;
  retry: string;
  unfinished: string;
  unfinishedNote: string;
  continue: string;
}

export const STUDY_MESSAGES: Record<Lang, StudyMessages> = {
  vi: {
    title: 'Chương trình và mục tiêu',
    note: 'Đổi chương trình hoặc khóa thì phần xét tốt nghiệp theo lựa chọn mới. Lộ trình đã lập vẫn giữ phiên bản CTĐT lúc lập.',
    program: 'Chương trình',
    cohort: 'Khóa',
    cohortOption: (year) => `Khóa ${year}`,
    save: 'Lưu thay đổi',
    saving: 'Đang lưu…',
    saved: 'Đã lưu chương trình và mục tiêu.',
    saveFailed: 'Chưa lưu được. Thử lại sau ít phút.',
    loading: 'Đang tải…',
    loadFailed: 'Chưa tải được chương trình và mục tiêu của bạn.',
    retry: 'Thử lại',
    unfinished: 'Bạn chưa xong phần bắt đầu.',
    unfinishedNote: 'Chọn chương trình, khóa và mục tiêu để dùng các trang khác.',
    continue: 'Làm tiếp',
  },
  en: {
    title: 'Program and goal',
    note: 'A new program or cohort changes what the degree audit checks. Plans already made keep the curriculum version they were made with.',
    program: 'Program',
    cohort: 'Cohort',
    cohortOption: (year) => `Cohort ${year}`,
    save: 'Save changes',
    saving: 'Saving…',
    saved: 'Your program and goal are saved.',
    saveFailed: 'Nothing was saved. Try again in a few minutes.',
    loading: 'Loading…',
    loadFailed: 'Your program and goal could not be loaded.',
    retry: 'Try again',
    unfinished: 'You have not finished getting started.',
    unfinishedNote: 'Choose your program, cohort and goal to use the other pages.',
    continue: 'Continue',
  },
};
