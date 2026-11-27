import type { Lang } from '../locale.js';
import type { Term } from '../terms.js';

const years = (term: Term) => `${term.year}–${String(term.year + 1).slice(2)}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

interface DashboardMessages {
  viewTerm: string;
  backToNow: string;
  previousTerm: string;
  nextTerm: string;
  chooseTerm: string;
  now: string;
  preview: string;
  current: string;
  inProgressShort: string;
  progress: string;
  donutLabel: (passed: number, total: number | null, parts: string) => string;
  donutPart: (name: string, passed: number, required: number) => string;
  ofCredits: (total: number | null) => string;
  passed: string;
  inProgress: string;
  left: string;
  required: string;
  credits: (n: number) => string;
  creditUnit: string;
  cr: (n: number) => string;
  cumulativeGpa: string;
  targetGraduation: string;
  targetTerm: (term: Term) => string;
  termGpa: string;
  leftToGraduate: string;
  inProgressCredits: (n: number) => string;
  inTermCredits: (n: number) => string;
  comparedWith: (term: string) => string;
  groupsTitle: string;
  barLabel: (d: number, c: number, left: number | null, required: number) => string;
  failed: string;
  termSection: (term: Term) => string;
  notInPlan: string;
  dragMore: (group: string, required: number) => string;
  grade: (grade: string) => string;
  retake: string;
  slot: string;
  termMeta: (average: string, credits: number) => string;
  attention: string;
  termSummary: string;
  violations: (n: number) => string;
  fixInPlan: string;
  noLanguageCertificate: string;
  languageNotChecked: string;
  certificateUnknown: string;
  seeCondition: string;
  unchosenElectives: (n: number) => string;
  chooseCourse: string;
  cumulativeAverage: string;
  earned: string;
  yearLevel: string;
  yearNumber: (year: number) => string;
  byTerm: string;
  importTranscript: string;
  graduation: string;
  planned: string;
  termAria: (label: string, credits: number) => string;
  gpaOf: (average: string) => string;
  cellTitle: (code: string, name: string, credits: number) => string;
}

export const DASHBOARD_MESSAGES: Record<Lang, DashboardMessages> = {
  vi: {
    viewTerm: 'Xem học kỳ',
    backToNow: 'Về học kỳ hiện tại',
    previousTerm: 'Học kỳ trước',
    nextTerm: 'Học kỳ sau',
    chooseTerm: 'Chọn học kỳ',
    now: ' · nay',
    preview: 'xem trước',
    current: 'Hiện tại',
    inProgressShort: 'Đang học',
    progress: 'Tiến độ chương trình',
    donutLabel: (passed, total, parts) => `${passed} trên ${total ?? '—'} tín chỉ đã tích lũy. ${parts}`,
    donutPart: (name, passed, required) => `${name} ${passed} trên ${required}`,
    ofCredits: (total) => `/ ${total ?? '—'} tín chỉ`,
    passed: 'Đã đạt',
    inProgress: 'Đang học',
    left: 'Còn lại',
    required: 'Yêu cầu',
    credits: (n) => `${n} tín chỉ`,
    creditUnit: 'TC',
    cr: (n) => `${n} TC`,
    cumulativeGpa: 'GPA tích lũy',
    targetGraduation: 'Mục tiêu tốt nghiệp',
    targetTerm: (term) => `${term.number === 3 ? 'Hè' : `HK${term.number}`} ${years(term)}`,
    termGpa: 'ĐTB học kỳ',
    leftToGraduate: 'Cần để tốt nghiệp',
    inProgressCredits: (n) => `${n} TC đang học`,
    inTermCredits: (n) => `${n} TC trong kỳ`,
    comparedWith: (term) => `So với cuối ${term}`,
    groupsTitle: 'Nhóm yêu cầu',
    barLabel: (d, c, left, required) => `Đã đạt ${d}, đang học ${c}, còn lại ${left ?? '—'} trên ${required} tín chỉ`,
    failed: 'Chưa đạt',
    termSection: (term) => (term.number === 3 ? `Học kỳ hè, ${years(term)}` : `Học kỳ ${term.number}, ${years(term)}`),
    notInPlan: 'Chưa xếp vào lộ trình',
    dragMore: (group, required) => `Kéo thêm học phần ${group.toLowerCase()} vào lộ trình để đủ ${required} tín chỉ.`,
    grade: (grade) => `Điểm ${grade}`,
    retake: 'Học lại',
    slot: 'Tự chọn chưa chọn môn',
    termMeta: (average, credits) => `ĐTB ${average} · ${credits} tín chỉ`,
    attention: 'Cần chú ý',
    termSummary: 'Tổng kết học kỳ',
    violations: (n) => `${n} vi phạm trong lộ trình`,
    fixInPlan: 'Sửa trong lộ trình',
    noLanguageCertificate: 'Chưa có chứng chỉ ngoại ngữ',
    languageNotChecked: 'Ngoại ngữ: chưa kiểm tra',
    certificateUnknown: 'App chưa biết chứng chỉ của bạn',
    seeCondition: 'Xem điều kiện',
    unchosenElectives: (n) => `${n} TC tự chọn chưa chọn môn`,
    chooseCourse: 'Chọn môn',
    cumulativeAverage: 'ĐTB tích lũy',
    earned: 'Tín chỉ tích lũy',
    yearLevel: 'Trình độ',
    yearNumber: (year) => `Năm thứ ${year}`,
    byTerm: 'Theo học kỳ',
    importTranscript: 'Nhập bảng điểm',
    graduation: 'Tốt nghiệp',
    planned: 'Dự kiến',
    termAria: (label, credits) => `${label}, ${credits} tín chỉ`,
    gpaOf: (average) => `ĐTB ${average}`,
    cellTitle: (code, name, credits) => `${code} · ${name} · ${credits} TC`,
  },
  en: {
    viewTerm: 'View a term',
    backToNow: 'Back to the current term',
    previousTerm: 'Previous term',
    nextTerm: 'Next term',
    chooseTerm: 'Choose a term',
    now: ' · now',
    preview: 'preview',
    current: 'Current',
    inProgressShort: 'In progress',
    progress: 'Program progress',
    donutLabel: (passed, total, parts) => `${passed} of ${total ?? '—'} credits earned. ${parts}`,
    donutPart: (name, passed, required) => `${name} ${passed} of ${required}`,
    ofCredits: (total) => `/ ${total ?? '—'} credits`,
    passed: 'Passed',
    inProgress: 'In progress',
    left: 'Remaining',
    required: 'Required',
    credits: (n) => plural(n, 'credit'),
    creditUnit: 'cr',
    cr: (n) => `${n} cr`,
    cumulativeGpa: 'Cumulative GPA',
    targetGraduation: 'Target graduation',
    targetTerm: (term) => `${term.number === 3 ? 'Summer' : `T${term.number}`} ${years(term)}`,
    termGpa: 'Term GPA',
    leftToGraduate: 'Left to graduate',
    inProgressCredits: (n) => `${n} cr in progress`,
    inTermCredits: (n) => `${n} cr in the term`,
    comparedWith: (term) => `Compared with the end of ${term}`,
    groupsTitle: 'Requirement groups',
    barLabel: (d, c, left, required) => `Passed ${d}, in progress ${c}, remaining ${left ?? '—'} of ${required} credits`,
    failed: 'Failed',
    termSection: (term) => (term.number === 3 ? `Summer term, ${years(term)}` : `Term ${term.number}, ${years(term)}`),
    notInPlan: 'Not in the plan yet',
    dragMore: (group, required) => `Drag more ${group} courses into the plan to reach ${required} credits.`,
    grade: (grade) => `Grade ${grade}`,
    retake: 'Retake',
    slot: 'Elective not chosen yet',
    termMeta: (average, credits) => `GPA ${average} · ${plural(credits, 'credit')}`,
    attention: 'Needs attention',
    termSummary: 'Term summary',
    violations: (n) => `${plural(n, 'issue')} in the plan`,
    fixInPlan: 'Fix in the plan',
    noLanguageCertificate: 'No language certificate yet',
    languageNotChecked: 'Language: not checked',
    certificateUnknown: "App doesn't know your certificate",
    seeCondition: 'See the condition',
    unchosenElectives: (n) => `${plural(n, 'elective credit')} not chosen yet`,
    chooseCourse: 'Choose a course',
    cumulativeAverage: 'Cumulative GPA',
    earned: 'Credits earned',
    yearLevel: 'Year level',
    yearNumber: (year) => `Year ${year}`,
    byTerm: 'By term',
    importTranscript: 'Import transcript',
    graduation: 'Graduation',
    planned: 'Planned',
    termAria: (label, credits) => `${label}, ${plural(credits, 'credit')}`,
    gpaOf: (average) => `GPA ${average}`,
    cellTitle: (code, name, credits) => `${code} · ${name} · ${credits} cr`,
  },
};
