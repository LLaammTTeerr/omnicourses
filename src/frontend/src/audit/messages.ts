import type { RequirementGroupKind } from '../curriculum/api.js';
import type { Lang } from '../locale.js';
import type { AuditWarningCode, CapRule, Classification, CourseStatus, TermKind } from './api.js';

// The words of the dashboard and the degree audit. Every number they hold is the API's; these only phrase it.

interface AuditMessages {
  dashboardTitle: string;
  auditTitle: string;
  auditLead: string;
  curriculum: (code: string, year: 1 | 2 | 3 | 4) => string;
  loading: string;
  loadFailed: string;
  retry: string;
  onboardingRequired: string;
  onboardingRequiredText: string;
  finishOnboarding: string;
  curriculumNotFound: string;
  curriculumNotFoundText: string;
  openSettings: string;
  noTranscriptTitle: string;
  noTranscriptText: string;
  enterTranscript: string;
  // Graduation
  graduation: string;
  graduationDone: string;
  graduationNotYet: string;
  graduationDoneText: (notChecked: number) => string;
  graduationNotYetText: (unmet: number) => string;
  met: string;
  notMet: string;
  notChecked: string;
  notCheckedTitle: string;
  notCheckedText: string;
  metTitle: string;
  unmetTitle: string;
  // Credits
  creditsTitle: string;
  creditsOf: (passed: number, total: number | null) => string;
  totalNotRecorded: string;
  inProgress: (n: number) => string;
  remaining: (n: number) => string;
  accumulated: (n: number) => string;
  accumulatedHint: string;
  creditsShort: (n: number) => string;
  // GPA
  gpaTitle: string;
  average: string;
  accumulatedAverage: string;
  fourPoint: string;
  classification: string;
  classifications: Record<Classification, string>;
  noGrade: string;
  // Groups
  groupsTitle: string;
  legendPassed: string;
  legendOverflow: string;
  legendInProgress: string;
  kinds: Record<RequirementGroupKind, string>;
  groupCredits: (passed: number, required: number) => string;
  noMinimum: string;
  noMinimumIn: (names: string) => string;
  overflowIn: (n: number) => string;
  overflowOut: (n: number, target: string | null) => string;
  missing: string;
  missingCredits: (n: number) => string;
  toPass: string;
  nothingMissing: string;
  combinedTitle: string;
  combinedCredits: (credits: number, min: number) => string;
  combinedOf: (names: string) => string;
  // Unmet on the dashboard
  attentionTitle: string;
  attentionNone: string;
  attentionMore: (n: number) => string;
  seeAudit: string;
  // Courses
  courseTable: (group: string) => string;
  code: string;
  course: string;
  credits: string;
  status: string;
  grade: string;
  statuses: Record<CourseStatus, string>;
  countedIn: (group: string) => string;
  outsideTotal: string;
  outsideGpa: string;
  results: { exempt: string; pass: string; fail: string };
  // Terms
  termsTitle: string;
  term: string;
  termKinds: Record<TermKind, string>;
  load: string;
  passed: string;
  termAverage: string;
  termAccumulated: string;
  cumulative: string;
  caps: (min: number | null, max: number) => string;
  capRules: Record<CapRule, (credits: number, limit: number) => string>;
  noViolation: string;
  // Unmatched and warnings
  unmatchedTitle: string;
  unmatchedText: string;
  warningsTitle: string;
  warnings: Record<AuditWarningCode, (code: string) => string>;
  // Conditions
  totalCondition: (n: number | null) => string;
  combinedCondition: (name: string, min: number) => string;
  conditions: Record<string, string>;
  citation: string;
  // Links
  nextTitle: string;
  openAudit: string;
  openAuditText: string;
  openExplorer: string;
  openExplorerText: string;
  openTranscript: string;
  openTranscriptText: string;
  openPlanner: string;
  openPlannerText: string;
  soon: string;
  engineNote: string;
}

export const AUDIT_MESSAGES: Record<Lang, AuditMessages> = {
  vi: {
    dashboardTitle: 'Tổng quan',
    auditTitle: 'Xét tốt nghiệp',
    auditLead: 'Từng nhóm yêu cầu, các học phần đã được tính, số tín chỉ và phần còn thiếu, theo bảng điểm bạn đã lưu.',
    curriculum: (code, year) => `${code} · sinh viên năm ${year}`,
    loading: 'Đang xét bảng điểm…',
    loadFailed: 'Chưa tải được kết quả xét tốt nghiệp.',
    retry: 'Thử lại',
    onboardingRequired: 'Bạn chưa chọn chương trình và khóa.',
    onboardingRequiredText: 'Cần biết chương trình và khóa của bạn thì mới xét được tiến độ tốt nghiệp.',
    finishOnboarding: 'Hoàn tất khai báo',
    curriculumNotFound: 'Chưa có chương trình đào tạo cho chương trình và khóa bạn chọn.',
    curriculumNotFoundText: 'Đổi chương trình hoặc khóa trong Cài đặt, hoặc chờ chương trình đào tạo được nhập.',
    openSettings: 'Mở Cài đặt',
    noTranscriptTitle: 'Chưa có bảng điểm.',
    noTranscriptText: 'Kết quả dưới đây coi như bạn chưa đạt học phần nào. Nhập bảng điểm để xét đúng tiến độ của bạn.',
    enterTranscript: 'Nhập bảng điểm',
    graduation: 'Điều kiện tốt nghiệp',
    graduationDone: 'Đạt mọi điều kiện kiểm tra được',
    graduationNotYet: 'Chưa đủ điều kiện tốt nghiệp',
    graduationDoneText: (n) => `Còn ${n} điều kiện OmniCourse không kiểm tra được, phòng đào tạo sẽ xét.`,
    graduationNotYetText: (n) => `Còn ${n} điều kiện chưa đạt.`,
    met: 'Đã đạt',
    notMet: 'Chưa đạt',
    notChecked: 'Chưa kiểm tra',
    notCheckedTitle: 'Trường sẽ xét',
    notCheckedText: 'Dữ liệu của OmniCourse không cho biết các điều kiện này, nên chúng không bao giờ được coi là đã đạt.',
    metTitle: 'Đã đạt',
    unmetTitle: 'Chưa đạt',
    creditsTitle: 'Tín chỉ',
    creditsOf: (passed, total) => (total === null ? `${passed} TC` : `${passed} / ${total} TC`),
    totalNotRecorded: 'Chưa ghi nhận tổng số tín chỉ của khóa.',
    inProgress: (n) => `${n} TC đang học`,
    remaining: (n) => `còn ${n} TC`,
    accumulated: (n) => `${n} TC tích lũy`,
    accumulatedHint: 'Tích lũy gồm cả các học phần bắt buộc ngoài tổng tín chỉ của khóa (Điều 11.4).',
    creditsShort: (n) => `${n} TC`,
    gpaTitle: 'Điểm trung bình',
    average: 'ĐTB (Điều 15.1.a)',
    accumulatedAverage: 'ĐTB tích lũy (Điều 15.1.b)',
    fourPoint: 'Thang 4 (tham khảo)',
    classification: 'Xếp loại',
    classifications: { excellent: 'Xuất sắc', very_good: 'Giỏi', good: 'Khá', fairly_good: 'Trung bình khá', average: 'Trung bình', weak: 'Yếu', poor: 'Kém' },
    noGrade: 'Chưa có',
    groupsTitle: 'Nhóm yêu cầu',
    legendPassed: 'Đã đạt',
    legendOverflow: 'Chuyển từ nhóm khác',
    legendInProgress: 'Đang học',
    kinds: { compulsory: 'Bắt buộc', elective: 'Tự chọn' },
    groupCredits: (passed, required) => `${passed} / ${required} TC`,
    noMinimum: 'Không có tối thiểu riêng',
    noMinimumIn: (names) => `Không có tối thiểu riêng · tính trong ${names}`,
    overflowIn: (n) => `+${n} TC dư từ nhóm khác`,
    overflowOut: (n, target) => (target ? `${n} TC dư tính cho ${target}` : `${n} TC dư tính cho nhóm khác`),
    missing: 'Còn thiếu',
    missingCredits: (n) => `${n} TC`,
    toPass: 'Học phần chưa đạt',
    nothingMissing: 'Không còn thiếu gì.',
    combinedTitle: 'Tối thiểu chung của nhiều nhóm',
    combinedCredits: (credits, min) => `${credits} / ${min} TC`,
    combinedOf: (names) => `Gồm: ${names}`,
    attentionTitle: 'Điều kiện chưa đạt',
    attentionNone: 'Không còn điều kiện nào chưa đạt.',
    attentionMore: (n) => `và ${n} điều kiện khác`,
    seeAudit: 'Xem chi tiết',
    courseTable: (group) => `Học phần của nhóm ${group}`,
    code: 'Mã',
    course: 'Học phần',
    credits: 'TC',
    status: 'Trạng thái',
    grade: 'Điểm',
    statuses: { passed: 'Đã đạt', in_progress: 'Đang học', failed: 'Chưa đạt', not_taken: 'Chưa học', counted_in_other_group: 'Tính ở nhóm khác' },
    countedIn: (group) => `Tính ở nhóm ${group}`,
    outsideTotal: 'Ngoài tổng TC',
    outsideGpa: 'Không tính ĐTB',
    results: { exempt: 'Miễn', pass: 'Đạt', fail: 'Không đạt' },
    termsTitle: 'Theo học kỳ',
    term: 'Học kỳ',
    termKinds: { main: 'Học kỳ chính', summer: 'Học kỳ hè' },
    load: 'Khối lượng',
    passed: 'Đạt',
    termAverage: 'ĐTB học kỳ',
    termAccumulated: 'ĐTB tích lũy học kỳ',
    cumulative: 'ĐTB tích lũy đến kỳ',
    caps: (min, max) => (min === null ? `tối đa ${max} TC` : `${min}–${max} TC`),
    capRules: {
      below_minimum: (credits, limit) => `${credits} TC, dưới mức tối thiểu ${limit} TC`,
      above_maximum: (credits, limit) => `${credits} TC, vượt mức tối đa ${limit} TC`,
    },
    noViolation: 'Trong giới hạn',
    unmatchedTitle: 'Học phần không được tính',
    unmatchedText: 'Không nhóm nào của chương trình đào tạo có các học phần này, nên chúng không được tính vào tín chỉ hay điểm trung bình.',
    warningsTitle: 'Lưu ý',
    warnings: {
      credits_differ: (code) => `${code}: số tín chỉ trong bảng điểm khác chương trình đào tạo; số nhỏ hơn được tính.`,
      same_term_attempts: (code) => `${code}: nhiều lần học xong trong cùng một học kỳ; kết quả thấp hơn được tính.`,
      not_in_curriculum: (code) => `${code}: không thuộc nhóm nào và chưa có học phần tương đương, nên không được tính.`,
    },
    totalCondition: (n) => (n === null ? 'Tổng tín chỉ của khóa chưa được ghi nhận' : `Tích lũy tối thiểu ${n} TC của khóa`),
    combinedCondition: (name, min) => `${name}: tối thiểu ${min} TC`,
    conditions: {
      no_prosecution_or_suspension: 'Không bị truy cứu trách nhiệm hình sự hoặc đang bị kỷ luật đình chỉ học tập',
      defence_education_certificate: 'Chứng chỉ Giáo dục quốc phòng - An ninh',
      foreign_language_standard: 'Chuẩn ngoại ngữ của trường',
      it_standard: 'Chuẩn tin học của chương trình',
      study_time_limit: 'Hoàn thành trong thời gian học tối đa',
    },
    citation: 'Căn cứ',
    nextTitle: 'Tiếp theo',
    openAudit: 'Xét tốt nghiệp chi tiết',
    openAuditText: 'Từng nhóm, từng học phần, từng học kỳ.',
    openExplorer: 'Chương trình đào tạo',
    openExplorerText: 'Xem các nhóm và học phần của khóa bạn.',
    openTranscript: 'Bảng điểm',
    openTranscriptText: 'Nhập hoặc sửa bảng điểm để xét lại.',
    openPlanner: 'Lộ trình',
    openPlannerText: 'Xếp các học phần còn lại vào từng học kỳ.',
    soon: 'Sắp có',
    engineNote: 'Mọi con số do rule engine tính từ bảng điểm bạn đã lưu, theo QĐ 1175/QĐ-KHTN. Không có con số nào do AI quyết định.',
  },
  en: {
    dashboardTitle: 'Dashboard',
    auditTitle: 'Degree audit',
    auditLead: 'Every requirement group, the courses counted in it, its credits and what is still missing, from the transcript you saved.',
    curriculum: (code, year) => `${code} · year ${year}`,
    loading: 'Checking your transcript…',
    loadFailed: 'The degree audit could not be loaded.',
    retry: 'Try again',
    onboardingRequired: 'You have not chosen your program and cohort yet.',
    onboardingRequiredText: 'Your progress toward graduation needs your program and cohort.',
    finishOnboarding: 'Finish onboarding',
    curriculumNotFound: 'There is no curriculum for the program and cohort you chose.',
    curriculumNotFoundText: 'Change your program or cohort in Settings, or wait until the curriculum is entered.',
    openSettings: 'Open Settings',
    noTranscriptTitle: 'No transcript yet.',
    noTranscriptText: 'The figures below assume you have passed no course. Enter your transcript to see your real progress.',
    enterTranscript: 'Enter your transcript',
    graduation: 'Graduation',
    graduationDone: 'Every condition OmniCourse can check is met',
    graduationNotYet: 'Not ready to graduate yet',
    graduationDoneText: (n) => `${n} conditions OmniCourse cannot check remain for the training office.`,
    graduationNotYetText: (n) => `${n} conditions not met yet.`,
    met: 'Met',
    notMet: 'Not met',
    notChecked: 'Not checked',
    notCheckedTitle: 'For the school to check',
    notCheckedText: 'OmniCourse has no data on these conditions, so it never treats them as met.',
    metTitle: 'Met',
    unmetTitle: 'Not met',
    creditsTitle: 'Credits',
    creditsOf: (passed, total) => (total === null ? `${passed} credits` : `${passed} / ${total} credits`),
    totalNotRecorded: 'The cohort total is not recorded.',
    inProgress: (n) => `${n} in progress`,
    remaining: (n) => `${n} to go`,
    accumulated: (n) => `${n} accumulated`,
    accumulatedHint: 'Accumulated credits include required courses outside the cohort total (Điều 11.4).',
    creditsShort: (n) => `${n} cr`,
    gpaTitle: 'Averages',
    average: 'Average (Điều 15.1.a)',
    accumulatedAverage: 'Accumulated average (Điều 15.1.b)',
    fourPoint: '4-point scale (reference)',
    classification: 'Classification',
    classifications: { excellent: 'Excellent', very_good: 'Very good', good: 'Good', fairly_good: 'Fairly good', average: 'Average', weak: 'Weak', poor: 'Poor' },
    noGrade: 'None yet',
    groupsTitle: 'Requirement groups',
    legendPassed: 'Passed',
    legendOverflow: 'From another group',
    legendInProgress: 'In progress',
    kinds: { compulsory: 'Compulsory', elective: 'Elective' },
    groupCredits: (passed, required) => `${passed} / ${required} credits`,
    noMinimum: 'No minimum of its own',
    noMinimumIn: (names) => `No minimum of its own · counts in ${names}`,
    overflowIn: (n) => `+${n} surplus credits from another group`,
    overflowOut: (n, target) => (target ? `${n} surplus credits count for ${target}` : `${n} surplus credits count for another group`),
    missing: 'Still missing',
    missingCredits: (n) => `${n} credits`,
    toPass: 'Courses not passed yet',
    nothingMissing: 'Nothing missing.',
    combinedTitle: 'Minimums across groups',
    combinedCredits: (credits, min) => `${credits} / ${min} credits`,
    combinedOf: (names) => `Adds up: ${names}`,
    attentionTitle: 'Conditions not met',
    attentionNone: 'No condition is left unmet.',
    attentionMore: (n) => `and ${n} more`,
    seeAudit: 'See details',
    courseTable: (group) => `Courses of ${group}`,
    code: 'Code',
    course: 'Course',
    credits: 'Cr',
    status: 'Status',
    grade: 'Grade',
    statuses: { passed: 'Passed', in_progress: 'In progress', failed: 'Not passed', not_taken: 'Not taken', counted_in_other_group: 'Counted elsewhere' },
    countedIn: (group) => `Counted in ${group}`,
    outsideTotal: 'Outside the total',
    outsideGpa: 'Not in the GPA',
    results: { exempt: 'Exempt', pass: 'Pass', fail: 'Fail' },
    termsTitle: 'By term',
    term: 'Term',
    termKinds: { main: 'Main term', summer: 'Summer term' },
    load: 'Load',
    passed: 'Passed',
    termAverage: 'Term average',
    termAccumulated: 'Term accumulated average',
    cumulative: 'Accumulated to date',
    caps: (min, max) => (min === null ? `at most ${max} credits` : `${min}–${max} credits`),
    capRules: {
      below_minimum: (credits, limit) => `${credits} credits, below the minimum of ${limit}`,
      above_maximum: (credits, limit) => `${credits} credits, above the maximum of ${limit}`,
    },
    noViolation: 'Within the caps',
    unmatchedTitle: 'Courses not counted',
    unmatchedText: 'No group of the curriculum lists these courses, so they count toward neither credits nor averages.',
    warningsTitle: 'Notes',
    warnings: {
      credits_differ: (code) => `${code}: the transcript and the curriculum give different credits; the smaller number counts.`,
      same_term_attempts: (code) => `${code}: several attempts finished in the same term; the worse result counts.`,
      not_in_curriculum: (code) => `${code}: in no group and with no recorded equivalent, so it does not count.`,
    },
    totalCondition: (n) => (n === null ? 'The cohort total is not recorded' : `At least ${n} credits toward the cohort total`),
    combinedCondition: (name, min) => `${name}: at least ${min} credits`,
    conditions: {
      no_prosecution_or_suspension: 'Not prosecuted, and not serving a suspension',
      defence_education_certificate: 'The national defence and security education certificate',
      foreign_language_standard: "The school's foreign-language standard",
      it_standard: 'The IT standard of the curriculum',
      study_time_limit: 'Finishing within the maximum study time',
    },
    citation: 'Basis',
    nextTitle: 'Next',
    openAudit: 'Full degree audit',
    openAuditText: 'Every group, course and term.',
    openExplorer: 'Curriculum',
    openExplorerText: 'The groups and courses of your cohort.',
    openTranscript: 'Transcript',
    openTranscriptText: 'Enter or correct your transcript to check again.',
    openPlanner: 'Roadmap',
    openPlannerText: 'Place the courses you still need in each term.',
    soon: 'Coming soon',
    engineNote: 'Every figure is worked out by the rule engine from the transcript you saved, under QĐ 1175/QĐ-KHTN. No figure is decided by AI.',
  },
};
