import type { GuideFile } from '../guide-file.js';

export default {
  id: 'grades-and-transcript',
  lang: 'en',
  status: 'published',
  version: 1,
  changeNote: 'First version.',
  lastChecked: { on: '2026-11-15', by: 'Dũng' },
  group: 'records-and-certificates',
  title: 'View your grades',
  keywords: ['grades', 'view grades', 'transcript', 'course results', 'gpa', 're-mark', 'retake'],
  summary:
    'See the grades of your courses, term by term, on the special programs portal. Every student needs this to look back at their results.',
  when: {
    text: 'After each term, once the grades are out. The special programs (Chương trình đề án) post grade and re-mark announcements under Thông báo Giáo vụ (academic announcements).',
    announcement: {
      label: 'Academic announcements, Chương trình đề án (in Vietnamese)',
      url: 'https://www.ctda.hcmus.edu.vn/vi/category/thong-bao/tb-giao-vu/',
    },
  },
  appliesTo: 'Students of the Advanced Program in Computer Science (APCS).',
  portal: {
    name: 'Portal Chương trình đề án (special programs portal)',
    url: 'https://portal.ctdb.hcmus.edu.vn/sinh-vien/ket-qua-hoc-phan',
    account: 'Your student ID and your special programs portal password',
  },
  prepare: [
    {
      text: 'Your special programs portal account. If you forgot the password, see the guide on accounts.',
      link: { label: 'Your school accounts and portals', url: '/guides/accounts-and-portals' },
    },
  ],
  steps: [
    { text: 'Open the special programs portal. Enter your student ID in “Username:” and your password in “Password:”, then press “Login”.' },
    { text: 'In the menu, choose “SINH VIÊN” (Student) → “Kết Quả Học Phần” (Course results).' },
    {
      text: 'To see one term, choose it in the list that shows “--Tất cả HK--” (All terms). The grade of each course is in the “Điểm tổng thang 10” (Total, out of 10) column. The “Môn học lại” (Retaken course) column marks a course you took again.',
    },
    { text: 'Check that every term and course you have taken is listed.' },
  ],
  notes: [
    {
      text: 'Neither the special programs portal nor the school portal has a button to download your transcript as a PDF file.',
      source: { kind: 'team' },
    },
    {
      text: 'Your grades are personal data. Do not post screenshots of this page to chat groups or social media.',
      source: { kind: 'team' },
    },
    {
      text: 'If a grade looks wrong, ask for a re-mark (phúc khảo) within the period given in that term’s re-mark announcement, under Thông báo Giáo vụ. The announcement says that after this period, complaints are not handled.',
      source: { kind: 'team' },
    },
  ],
} satisfies GuideFile;
