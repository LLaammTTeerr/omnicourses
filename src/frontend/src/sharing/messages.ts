import type { Lang } from '../locale.js';

export interface SharingMessages {
  dialogTitle: string;
  dialogLead: (name: string) => string;
  loading: string;
  loadFailed: string;
  actionFailed: string;
  retry: string;
  close: string;
  seesHeading: string;
  seesItems: readonly string[];
  neverShownHeading: string;
  neverShownBody: string;
  showName: string;
  showNameWith: (name: string) => string;
  showTranscriptChecks: string;
  transcriptChecksHint: string;
  transcriptPrivacyWarningTitle: string;
  transcriptPrivacyWarning: string;
  linkAnyoneNote: string;
  liveLinkLabel: string;
  createdOn: (when: string) => string;
  createLink: string;
  creatingLink: string;
  copyLink: string;
  copiedLink: string;
  copiedToast: string;
  copyFallback: string;
  openShared: string;
  stopSharing: string;
  stoppingSharing: string;
  createdToast: string;
  stoppedToast: string;
  sharedPlanTitle: string;
  readonlyBanner: string;
  updatedAt: (when: string) => string;
  sharedBy: (name: string) => string;
  cohort: (year: string | number) => string;
  curriculumCode: (code: string) => string;
  printPdf: string;
  viewLoading: string;
  viewLoadFailed: string;
  rateLimited: string;
  notSharedTitle: string;
  notSharedBody: string;
  backHome: string;
  withheldTitle: string;
  withheldBody: (checks: readonly string[]) => string;
  emptyTerms: string;
  emptyTerm: string;
  issuesLead: string;
  noIssuesPartialTitle: string;
  noIssuesPartialBody: string;
  combinedMinimumsHeading: string;
  privacyFooter: string;
}

export const SHARING_MESSAGES: Record<Lang, SharingMessages> = {
  vi: {
    dialogTitle: 'Chia sẻ kế hoạch',
    dialogLead: (name) => `Tạo liên kết chỉ đọc cho kế hoạch “${name}” để gửi cho giảng viên cố vấn mà không cần tài khoản.`,
    loading: 'Đang tải trạng thái chia sẻ…',
    loadFailed: 'Chưa tải được trạng thái chia sẻ của kế hoạch này.',
    actionFailed: 'Chưa cập nhật được liên kết chia sẻ. Hãy thử lại.',
    retry: 'Thử lại',
    close: 'Đóng',
    seesHeading: 'Người mở liên kết sẽ thấy',
    seesItems: [
      'Tên kế hoạch, chương trình, khóa, phiên bản chương trình đào tạo và thời điểm sửa gần nhất',
      'Từng học kỳ với các học phần đã xếp, chỗ tự chọn, tổng tín chỉ và giới hạn tín chỉ',
      'Các vi phạm do rule engine tính từ kế hoạch và chương trình đào tạo',
    ],
    neverShownHeading: 'Không bao giờ hiển thị',
    neverShownBody: 'Điểm số, các dòng bảng điểm, email, MSSV và các kế hoạch khác của bạn.',
    showName: 'Hiện tên hiển thị của tôi trên trang chia sẻ',
    showNameWith: (name) => `Hiện tên hiển thị của tôi (${name})`,
    showTranscriptChecks: 'Hiện cả kiểm tra từ bảng điểm và mức đáp ứng nhóm học phần',
    transcriptChecksHint: 'Thêm kiểm tra thiếu môn tiên quyết, môn đã đạt hoặc đang học, và tiến độ từng nhóm yêu cầu.',
    transcriptPrivacyWarningTitle: 'Người xem có thể suy ra quá trình học của bạn',
    transcriptPrivacyWarning:
      'Khi bật mục này, người có liên kết có thể suy ra bạn đã đạt, trượt hoặc đang học những học phần nào dựa trên kiểm tra môn tiên quyết và mức đáp ứng yêu cầu. Điểm số và các dòng bảng điểm không bao giờ hiển thị.',
    linkAnyoneNote: 'Bất kỳ ai giữ liên kết đều mở được kế hoạch mà không cần đăng nhập. OmniCourse không tự gửi liên kết cho ai.',
    liveLinkLabel: 'Liên kết đang hoạt động',
    createdOn: (when) => `Tạo lúc ${when}`,
    createLink: 'Tạo liên kết chia sẻ',
    creatingLink: 'Đang tạo liên kết…',
    copyLink: 'Sao chép liên kết',
    copiedLink: 'Đã sao chép',
    copiedToast: 'Đã sao chép liên kết chia sẻ.',
    copyFallback: 'Đã chọn liên kết — nhấn Ctrl+C (hoặc Cmd+C) để sao chép.',
    openShared: 'Mở trang chia sẻ',
    stopSharing: 'Ngừng chia sẻ',
    stoppingSharing: 'Đang ngừng…',
    createdToast: 'Đã tạo liên kết chia sẻ chỉ đọc.',
    stoppedToast: 'Đã ngừng chia sẻ. Liên kết cũ không còn hoạt động.',
    sharedPlanTitle: 'Kế hoạch được chia sẻ',
    readonlyBanner: 'Kế hoạch được chia sẻ · chỉ đọc',
    updatedAt: (when) => `Sửa lần cuối ${when}`,
    sharedBy: (name) => `${name} chia sẻ`,
    cohort: (year) => `Khóa ${year}`,
    curriculumCode: (code) => `CTĐT ${code}`,
    printPdf: 'In / Lưu PDF',
    viewLoading: 'Đang tải kế hoạch được chia sẻ…',
    viewLoadFailed: 'Chưa tải được kế hoạch được chia sẻ. Hãy thử lại.',
    rateLimited: 'Quá nhiều yêu cầu trong thời gian ngắn. Hãy đợi một chút rồi thử lại.',
    notSharedTitle: 'Kế hoạch này không được chia sẻ',
    notSharedBody: 'Liên kết có thể đã ngừng chia sẻ, gõ sai, hoặc kế hoạch không còn tồn tại. Hãy hỏi lại người đã gửi liên kết cho bạn.',
    backHome: 'Về trang chủ',
    withheldTitle: 'Một số kiểm tra phụ thuộc bảng điểm không được hiển thị',
    withheldBody: (checks) =>
      `Sinh viên không bật hiển thị các kiểm tra dựa trên bảng điểm (${checks.join(', ')}) và mức đáp ứng từng nhóm học phần. Không thấy vi phạm ở đây không đồng nghĩa các mục đó đã đạt.`,
    emptyTerms: 'Kế hoạch này chưa xếp học phần nào vào các học kỳ.',
    emptyTerm: 'Chưa xếp học phần nào ở học kỳ này.',
    issuesLead: 'Do rule engine tính trực tiếp từ kế hoạch hiện tại và quy chế đào tạo, không do AI.',
    noIssuesPartialTitle: 'Không thấy vi phạm trong các kiểm tra được hiển thị',
    noIssuesPartialBody: 'Các kiểm tra phụ thuộc bảng điểm không nằm trong liên kết này.',
    combinedMinimumsHeading: 'Tối thiểu gộp giữa các nhóm',
    privacyFooter:
      'Trang chỉ đọc này không bao giờ hiển thị điểm số, dòng bảng điểm, email, MSSV hay các kế hoạch khác. Công cụ tìm kiếm được yêu cầu không lập chỉ mục trang này.',
  },
  en: {
    dialogTitle: 'Share plan',
    dialogLead: (name) => `Create a read-only shared plan link for “${name}” to give an advisor — no OmniCourse account needed.`,
    loading: 'Loading sharing status…',
    loadFailed: 'Could not load the sharing status of this plan.',
    actionFailed: 'Could not update the shared plan link. Please try again.',
    retry: 'Try again',
    close: 'Close',
    seesHeading: 'What anyone with the link sees',
    seesItems: [
      'Plan name, program, cohort, curriculum version, and when it was last changed',
      'Each term with placed courses, elective slots, credit load, and credit caps',
      'Violations computed by the rule engine from the plan and its curriculum',
    ],
    neverShownHeading: 'Never shown',
    neverShownBody: 'Grades, transcript rows, email, student ID, and your other plans.',
    showName: 'Show my display name on the shared plan',
    showNameWith: (name) => `Show my display name (${name})`,
    showTranscriptChecks: 'Include checks from my transcript and requirement coverage',
    transcriptChecksHint: 'Adds missing prerequisites, courses already passed or in progress, and requirement-group coverage.',
    transcriptPrivacyWarningTitle: 'Anyone with the link can infer your course history',
    transcriptPrivacyWarning:
      'With this turned on, a reader can infer which courses you have passed, failed, or are taking in progress from prerequisite checks and requirement coverage. Grades and transcript rows are never shown.',
    linkAnyoneNote: 'Anyone holding this link can open the shared plan without signing in. OmniCourse never sends it to anyone on its own.',
    liveLinkLabel: 'Active link',
    createdOn: (when) => `Created ${when}`,
    createLink: 'Create share link',
    creatingLink: 'Creating link…',
    copyLink: 'Copy link',
    copiedLink: 'Copied',
    copiedToast: 'Copied shared plan link.',
    copyFallback: 'Link selected — press Ctrl+C (or Cmd+C) to copy.',
    openShared: 'Open shared plan',
    stopSharing: 'Stop sharing',
    stoppingSharing: 'Stopping…',
    createdToast: 'Created read-only shared plan link.',
    stoppedToast: 'Stopped sharing. The link no longer works.',
    sharedPlanTitle: 'Shared plan',
    readonlyBanner: 'Shared plan · read-only',
    updatedAt: (when) => `Last changed ${when}`,
    sharedBy: (name) => `Shared by ${name}`,
    cohort: (year) => `Cohort ${year}`,
    curriculumCode: (code) => `Curriculum ${code}`,
    printPdf: 'Print / Save as PDF',
    viewLoading: 'Loading shared plan…',
    viewLoadFailed: 'Could not load this shared plan. Please try again.',
    rateLimited: 'Too many requests right now. Please wait a moment and try again.',
    notSharedTitle: 'This plan is not shared',
    notSharedBody: 'The link may have been stopped, mistyped, or its plan may no longer exist. Ask the person who sent it for a current link.',
    backHome: 'Back to home',
    withheldTitle: 'Transcript-dependent checks are not shown',
    withheldBody: (checks) =>
      `The student chose not to include checks that depend on their transcript (${checks.join(', ')}) or requirement-group coverage. Having no violations listed here does not mean those checks are met.`,
    emptyTerms: 'No courses have been placed into terms in this plan yet.',
    emptyTerm: 'No courses placed in this term.',
    issuesLead: 'Computed deterministically by the rule engine from the current plan and training regulation, never by AI.',
    noIssuesPartialTitle: 'No violations in the shown checks',
    noIssuesPartialBody: 'Checks that depend on the student’s transcript are not included in this link.',
    combinedMinimumsHeading: 'Combined minimums',
    privacyFooter:
      'This read-only page never shows grades, transcript rows, email, student ID, or other plans. Search engines are instructed not to index it.',
  },
};
