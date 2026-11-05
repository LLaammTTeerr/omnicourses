import type { GuideGroup } from '../guides-api.js';
import type { Lang } from '../locale.js';

// The strings of the guide pages. The guide text itself comes from the API.
export interface GuideMessages {
  groups: Record<GuideGroup, string>;
  listTitle: string;
  listIntro: string;
  noPortalAccess: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchHint: string;
  loading: string;
  loadFailed: string;
  retry: string;
  noGuides: string;
  noMatch: string;
  browseGroups: string;
  account: string;
  openPortal: (portal: string) => string;
  newTab: string;
  outOfDateChip: string;
  checkedOn: (date: string) => string;
  onlyOtherLanguage: string;
  guides: string;
  where: string;
  when: string;
  appliesTo: string;
  prepare: string;
  steps: string;
  notes: string;
  source: string;
  teamExperience: string;
  ifPortalDown: string;
  citations: string;
  related: string;
  board: string;
  outOfDateTitle: string;
  outOfDateText: (date: string) => string;
  version: (version: number, date: string, by: string) => string;
  changeNote: (note: string) => string;
  fallbackNote: string;
  notFoundTitle: string;
  notFoundText: string;
  allGuides: string;
}

export const GUIDE_MESSAGES: Record<Lang, GuideMessages> = {
  vi: {
    groups: {
      'accounts-and-portals': 'Tài khoản và cổng thông tin',
      registration: 'Đăng ký học phần',
      'timetable-and-exams': 'Thời khóa biểu và lịch thi',
      'tuition-and-fees': 'Học phí và lệ phí',
      'records-and-certificates': 'Bảng điểm và giấy xác nhận',
      scholarships: 'Học bổng',
      'internship-and-thesis': 'Thực tập và khóa luận',
      graduation: 'Tốt nghiệp',
    },
    listTitle: 'Hướng dẫn thủ tục',
    listIntro: 'Những việc ở trường mà OmniCourse không làm thay bạn: link thẳng tới cổng, các bước và tài khoản cần dùng.',
    noPortalAccess: 'OmniCourse chỉ dẫn link tới cổng của trường. OmniCourse không đăng nhập vào cổng và không bao giờ hỏi mật khẩu cổng của bạn.',
    searchLabel: 'Bạn cần làm gì?',
    searchPlaceholder: 'Thử: hoc phi, đăng ký, bảng điểm',
    searchHint: 'Tìm bằng tiếng Việt hoặc tiếng Anh, có dấu hoặc không dấu.',
    loading: 'Đang tải hướng dẫn…',
    loadFailed: 'Chưa tải được hướng dẫn. Hãy thử lại sau ít phút.',
    retry: 'Thử lại',
    noGuides: 'Chưa có hướng dẫn nào được đăng.',
    noMatch: 'Chưa có hướng dẫn cho việc này.',
    browseGroups: 'Xem theo nhóm việc:',
    account: 'Tài khoản:',
    openPortal: (portal) => `Mở ${portal}`,
    newTab: ' (mở ở tab mới)',
    outOfDateChip: 'Có thể đã cũ',
    checkedOn: (date) => `Kiểm tra ngày ${date}`,
    onlyOtherLanguage: 'Chỉ có tiếng Anh',
    guides: 'Hướng dẫn',
    where: 'Làm ở đâu',
    when: 'Khi nào',
    appliesTo: 'Áp dụng cho',
    prepare: 'Cần chuẩn bị',
    steps: 'Các bước',
    notes: 'Lưu ý',
    source: 'Nguồn:',
    teamExperience: 'kinh nghiệm của nhóm OmniCourse',
    ifPortalDown: 'Nếu cổng không vào được',
    citations: 'Văn bản quy định',
    related: 'Xem thêm',
    board: 'Các cổng của trường',
    outOfDateTitle: 'Hướng dẫn này có thể đã cũ',
    outOfDateText: (date) =>
      `Nhóm kiểm tra lần cuối ngày ${date}, đã hơn 6 tháng. Cổng có thể đã thay đổi: hãy đối chiếu với những gì cổng hiển thị.`,
    version: (version, date, by) => `Phiên bản ${version} · kiểm tra trên cổng ngày ${date} bởi ${by}`,
    changeNote: (note) => `Thay đổi: ${note}`,
    fallbackNote: 'Hướng dẫn này hiện chỉ có bằng tiếng Anh.',
    notFoundTitle: 'Không tìm thấy hướng dẫn',
    notFoundText: 'Hướng dẫn này không tồn tại hoặc đã được gỡ.',
    allGuides: 'Xem tất cả hướng dẫn',
  },
  en: {
    groups: {
      'accounts-and-portals': 'Accounts and portals',
      registration: 'Registration',
      'timetable-and-exams': 'Timetable and exams',
      'tuition-and-fees': 'Tuition and fees',
      'records-and-certificates': 'Records and certificates',
      scholarships: 'Scholarships',
      'internship-and-thesis': 'Internship and thesis',
      graduation: 'Graduation',
    },
    listTitle: 'School task guides',
    listIntro: 'School tasks OmniCourse does not do for you: a direct link to the portal, the steps and the account you need.',
    noPortalAccess: "OmniCourse only links to the school's portals. It never signs in to them and never asks for your portal password.",
    searchLabel: 'What do you need to do?',
    searchPlaceholder: 'Try: tuition, register, hoc phi',
    searchHint: 'Search in Vietnamese or English, with or without accents.',
    loading: 'Loading guides…',
    loadFailed: 'Could not load the guides right now. Please try again in a moment.',
    retry: 'Try again',
    noGuides: 'No guides are published yet.',
    noMatch: 'No guide covers this yet.',
    browseGroups: 'Browse by task group:',
    account: 'Account:',
    openPortal: (portal) => `Open ${portal}`,
    newTab: ' (opens in a new tab)',
    outOfDateChip: 'May be out of date',
    checkedOn: (date) => `Checked on ${date}`,
    onlyOtherLanguage: 'Vietnamese only',
    guides: 'Guides',
    where: 'Where',
    when: 'When',
    appliesTo: 'Applies to',
    prepare: 'Prepare',
    steps: 'Steps',
    notes: 'Notes',
    source: 'Source:',
    teamExperience: "the OmniCourse team's experience",
    ifPortalDown: 'If the portal is down',
    citations: 'Regulations',
    related: 'See also',
    board: 'School portals',
    outOfDateTitle: 'This guide may be out of date',
    outOfDateText: (date) =>
      `A team member last checked it on ${date}, more than 6 months ago. The portal may have changed: compare with what the portal shows.`,
    version: (version, date, by) => `Version ${version} · checked on the portal on ${date} by ${by}`,
    changeNote: (note) => `What changed: ${note}`,
    fallbackNote: 'This guide is only available in Vietnamese.',
    notFoundTitle: 'Guide not found',
    notFoundText: 'This guide does not exist or has been withdrawn.',
    allGuides: 'See all guides',
  },
};
