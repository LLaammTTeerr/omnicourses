import type { Lang } from '../locale.js';
import type { CreditsProblem } from './answers.js';

interface OnboardingMessages {
  title: string;
  later: string;
  steps: string;
  step: (n: number, of: number, name: string) => string;
  stepNames: [string, string, string, string];
  programQuestion: string;
  programNote: string;
  otherPrograms: (n: number) => string;
  cohortQuestion: string;
  cohortOption: (year: number) => string;
  cohortSub: (program: string, year: number) => string;
  cohortNote: string;
  graduationQuestion: string;
  graduationNote: string;
  loadQuestion: string;
  back: string;
  next: string;
  finish: string;
  saving: string;
  pickProgram: string;
  pickCohort: string;
  loadFailed: string;
  saveFailed: string;
  rejected: string;
  finished: string;
}

interface GoalMessages {
  graduation: string;
  graduationHint: string;
  notSure: string;
  credits: string;
  creditsHint: string;
  creditsUnit: string;
  creditsProblems: Record<CreditsProblem, string>;
  internship: string;
  internshipHint: string;
  notAnswered: string;
  noInternship: string;
}

export const ONBOARDING_MESSAGES: Record<Lang, OnboardingMessages> = {
  vi: {
    title: 'Bắt đầu',
    later: 'Làm sau',
    steps: 'Các bước',
    step: (n, of, name) => `Câu ${n} / ${of} · ${name}`,
    stepNames: ['Chương trình', 'Khóa', 'Mục tiêu', 'Tải học'],
    programQuestion: 'Bạn đang học chương trình nào?',
    programNote: 'Mỗi chương trình có CTĐT và quy định tín chỉ riêng. Bản này chỉ có APCS; chương trình khác sẽ có khi dữ liệu được kiểm tra xong.',
    otherPrograms: (n) => `${n} chương trình khác chưa hỗ trợ trong bản này`,
    cohortQuestion: 'Bạn vào trường năm nào?',
    cohortOption: (year) => `Khóa ${year}`,
    cohortSub: (program, year) => `CTĐT ${program} của khóa nhập học ${year}`,
    cohortNote: 'Mỗi khóa theo CTĐT của khóa đó. Khóa sau đổi CTĐT không làm lộ trình của bạn sai.',
    graduationQuestion: 'Bạn muốn tốt nghiệp vào học kỳ nào?',
    graduationNote: 'Đây là mục tiêu của bạn. Học kỳ tốt nghiệp dự kiến sẽ do rule engine tính từ lộ trình.',
    loadQuestion: 'Mỗi học kỳ bạn muốn học bao nhiêu tín chỉ?',
    back: 'Quay lại',
    next: 'Tiếp',
    finish: 'Xong',
    saving: 'Đang lưu…',
    pickProgram: 'Hãy chọn một chương trình.',
    pickCohort: 'Hãy chọn khóa của bạn.',
    loadFailed: 'Chưa tải được câu trả lời của bạn.',
    saveFailed: 'Chưa lưu được. Câu trả lời vẫn còn ở đây; thử lại sau ít phút.',
    rejected: 'Máy chủ chưa nhận câu trả lời này:',
    finished: 'Đã lưu. Bạn có thể đổi các câu trả lời này trong Cài đặt.',
  },
  en: {
    title: 'Get started',
    later: 'Later',
    steps: 'Steps',
    step: (n, of, name) => `Question ${n} of ${of} · ${name}`,
    stepNames: ['Program', 'Cohort', 'Goal', 'Load'],
    programQuestion: 'Which program are you in?',
    programNote: 'Each program has its own curriculum and credit rules. This release has APCS only; others come once their data is checked.',
    otherPrograms: (n) => `${n} other ${n === 1 ? 'program is' : 'programs are'} not in this release yet`,
    cohortQuestion: 'Which year did you start?',
    cohortOption: (year) => `Cohort ${year}`,
    cohortSub: (program, year) => `The ${program} curriculum of the ${year} intake`,
    cohortNote: 'Each cohort follows its own curriculum. A later change to the curriculum does not make your plan wrong.',
    graduationQuestion: 'When do you want to graduate?',
    graduationNote: 'This is your goal. The rule engine will work out the expected graduation term from your plan.',
    loadQuestion: 'How many credits do you want to take each term?',
    back: 'Back',
    next: 'Next',
    finish: 'Finish',
    saving: 'Saving…',
    pickProgram: 'Choose a program.',
    pickCohort: 'Choose your cohort.',
    loadFailed: 'Your answers could not be loaded.',
    saveFailed: 'Nothing was saved. Your answers are still here; try again in a few minutes.',
    rejected: 'The server did not accept this answer:',
    finished: 'Saved. You can change these answers in Settings.',
  },
};

export const GOAL_MESSAGES: Record<Lang, GoalMessages> = {
  vi: {
    graduation: 'Học kỳ muốn tốt nghiệp',
    graduationHint: 'Từ học kỳ này đến 8 năm học sau.',
    notSure: 'Chưa biết',
    credits: 'Số tín chỉ mỗi học kỳ',
    creditsHint: 'Một số nguyên từ 1 trở lên, để trống nếu chưa biết. Giới hạn tín chỉ của chương trình được kiểm tra khi lập lộ trình, không phải ở đây.',
    creditsUnit: 'TC / học kỳ',
    creditsProblems: { whole: 'Nhập một số nguyên từ 1 trở lên.', tooLarge: 'Số này quá lớn.' },
    internship: 'Học kỳ đi thực tập',
    internshipHint: 'Lộ trình sẽ không xếp môn vào học kỳ này.',
    notAnswered: 'Chưa chọn',
    noInternship: 'Không thực tập',
  },
  en: {
    graduation: 'Graduation goal',
    graduationHint: 'From this term to eight academic years ahead.',
    notSure: 'Not sure yet',
    credits: 'Credits per term',
    creditsHint: 'A whole number of 1 or more, or empty if you are not sure. Your program’s credit limits are checked when a plan is built, not here.',
    creditsUnit: 'credits / term',
    creditsProblems: { whole: 'Enter a whole number of 1 or more.', tooLarge: 'This number is too large.' },
    internship: 'Internship term',
    internshipHint: 'Your plan will leave this term free of courses.',
    notAnswered: 'Not chosen',
    noInternship: 'No internship',
  },
};
