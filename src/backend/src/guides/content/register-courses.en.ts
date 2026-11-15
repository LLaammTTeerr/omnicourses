import type { GuideFile } from '../guide-file.js';

// G02 Register for courses (guides plan §4, §5). Sources: the sign-in page of
// portal.ctdb.hcmus.edu.vn, the school's notices on registration and student accounts
// (Chương trình đề án, 2022–2024) and Quy chế đào tạo QĐ 1175/QĐ-KHTN. Draft until a team member
// follows it on the portal; every "[CHECK: …]" is confirmed or removed first. Then set lastChecked
// and status 'published' (README.md in this folder). Search expectations: B1 test cases, GUIDE-01c.
export default {
  id: 'register-courses',
  lang: 'en',
  status: 'draft',
  version: 1,
  changeNote:
    'First version. Not checked to the end: registration was closed on the day of the check, so finding a course, choosing a class, the clash warning, confirming, cancelling and how a retake shows (the steps marked CHECK) wait for the next registration period.',
  lastChecked: { on: '2026-11-15', by: 'Dũng' },
  group: 'registration',
  title: 'Register for courses',
  keywords: ['register', 'course registration', 'register for courses', 'enrol', 'enroll', 'dkhp', 'retake'],
  summary:
    'Each main term, students register for the courses they will take on the special programs portal, within the period the special programs (Chương trình đề án) announce, and then check the result.',
  when: {
    text: 'Each main term, within the registration period given in that term’s announcement. The special programs post these announcements under Thông báo Giáo vụ (academic announcements).',
    announcement: {
      label: 'Academic announcements, Chương trình đề án (in Vietnamese)',
      url: 'https://www.ctda.hcmus.edu.vn/vi/category/thong-bao/tb-giao-vu/',
    },
  },
  appliesTo: 'Students of the Advanced Program in Computer Science (APCS).',
  portal: {
    name: 'Portal Chương trình đề án (special programs portal)',
    url: 'https://portal.ctdb.hcmus.edu.vn/dang-ky-hoc-phan/sinh-vien-apcs',
    account: 'Your student ID and your special programs portal password',
  },
  prepare: [
    {
      text: 'The courses that open during the academic year, to choose the courses for the next term.',
      link: {
        label: 'Study plans, Chương trình đề án (in Vietnamese)',
        url: 'https://www.ctda.hcmus.edu.vn/vi/category/thong-bao/ke-hoach-hoc-tap/',
      },
    },
    {
      text: 'The term’s registration announcement: the registration period, the courses that open and their classes.',
    },
    {
      text: 'The codes of the courses you plan to register for. The minimum and maximum credits per term depend on your program: see the notes below.',
    },
    {
      text: 'Your special programs portal account. If you forgot the password, see the guide on accounts.',
      link: { label: 'Your school accounts and portals', url: '/guides/accounts-and-portals' },
    },
  ],
  steps: [
    { text: 'Open the special programs portal. Enter your student ID in “Username:” and your password in “Password:”, then press “Login”.' },
    {
      text: 'In the menu, choose “SINH VIÊN” (Student) → “Đăng Ký Học Phần” (Course registration) → “Sinh viên CTTT” (APCS students). Outside the registration period, the page says “Đã hết thời gian đăng ký học phần!” (The registration period is over).',
    },
    { text: '[CHECK: how to find a course by its code, and the label of the search box]' },
    {
      text: 'Choose the class of each course from the class list in the registration announcement, so that no two classes clash. [CHECK: label for choosing a class; what the clash warning looks like]',
    },
    { text: '[CHECK: the button that confirms the registration; how to cancel a course during the registration period]' },
    {
      text: 'Check the result: choose “SINH VIÊN” (Student) → “Đăng Ký Học Phần” (Course registration) → “Kết Quả ĐKHP” (Registration results), and pick the term in the list. Make sure every course is there (“Mã MH”, course code), in the right class (“Lớp HP”), and that no two classes clash (“Lịch LT” and “Lịch TH”, the lecture and lab times).',
    },
    { text: '[CHECK: how a retake or grade-improvement course shows after you register it; the “Cập nhật tình trạng học lại/cải thiện” (Update retake/improvement status) button on “Kết Quả ĐKHP” is hidden outside the registration period]' },
    { text: 'After the registration period ends, open “Kết Quả ĐKHP” (Registration results) again to see the final result.' },
  ],
  notes: [
    {
      text: 'The minimum and maximum credits you may register for in a term depend on your program. To register for more than the maximum or fewer than the minimum, you need a written request that the Faculty supports and the Rector approves.',
      source: {
        kind: 'regulation',
        document: 'Quy chế đào tạo trình độ đại học (Decision 1175/QĐ-KHTN, in Vietnamese)',
        clause: 'Article 7, clause 2',
        url: 'https://www.ctda.hcmus.edu.vn/wp-content/uploads/2023/03/Quy-che-dao-tao-2021.pdf',
      },
    },
    {
      text: 'The Chương trình Tiên tiến (APCS) has three main terms in each academic year, so term 3 is a main term too, not a summer term.',
      source: {
        kind: 'regulation',
        document: 'Quy chế đào tạo trình độ đại học (Decision 1175/QĐ-KHTN, in Vietnamese)',
        clause: 'Article 6, clause 4, point b',
        url: 'https://www.ctda.hcmus.edu.vn/wp-content/uploads/2023/03/Quy-che-dao-tao-2021.pdf',
      },
    },
    {
      text: 'A course you did not pass must be registered again. For an elective you did not pass, you may retake it or choose another elective of your program instead.',
      source: {
        kind: 'regulation',
        document: 'Quy chế đào tạo trình độ đại học (Decision 1175/QĐ-KHTN, in Vietnamese)',
        clause: 'Article 14, clause 1',
        url: 'https://www.ctda.hcmus.edu.vn/wp-content/uploads/2023/03/Quy-che-dao-tao-2021.pdf',
      },
    },
    {
      text: 'If you register for a course and do not attend it, you are treated as having dropped out of it and get a grade of zero for it. Follow your registration result to confirm it, or change it in the term’s adjustment period.',
      source: {
        kind: 'regulation',
        document: 'Quy chế đào tạo trình độ đại học (Decision 1175/QĐ-KHTN, in Vietnamese)',
        clause: 'Article 7, clause 1, point d; clauses 3 and 4',
        url: 'https://www.ctda.hcmus.edu.vn/wp-content/uploads/2023/03/Quy-che-dao-tao-2021.pdf',
      },
    },
    {
      text: 'A class with fewer registered students than the minimum the school sets does not open.',
      source: {
        kind: 'regulation',
        document: 'Quy chế đào tạo trình độ đại học (Decision 1175/QĐ-KHTN, in Vietnamese)',
        clause: 'Article 8, clause 3, point a',
        url: 'https://www.ctda.hcmus.edu.vn/wp-content/uploads/2023/03/Quy-che-dao-tao-2021.pdf',
      },
    },
    {
      text: 'If a class is full or does not open, wait for the term’s adjustment period, or ask the academic office at giaovu@apcs.fitus.edu.vn. [CHECK: what a full class looks like on the portal]',
      source: { kind: 'team' },
    },
  ],
  related: [
    { label: 'Pay tuition', url: '/guides/pay-tuition' },
    { label: 'View your grades', url: '/guides/grades-and-transcript' },
  ],
} satisfies GuideFile;
