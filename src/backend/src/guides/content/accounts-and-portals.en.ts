import type { GuideFile } from '../guide-file.js';

// G01 Your school accounts and portals (guides plan §4, §5). Sources: the sign-in and
// "Forget Password" pages of portal.ctdb.hcmus.edu.vn, the sign-in page of Moodle CTDA, and the
// school's notice on student accounts for the Chương trình Tiên tiến 2023 cohort. The rest comes
// from following it on the portal (lastChecked). Search expectations: GUIDE-01c.
export default {
  id: 'accounts-and-portals',
  lang: 'en',
  status: 'published',
  version: 1,
  changeNote: 'First version.',
  lastChecked: { on: '2026-11-15', by: 'Dũng' },
  group: 'accounts-and-portals',
  title: 'Your school accounts and portals',
  keywords: ['accounts', 'portal', 'password', 'forgot password', 'sign in', 'student email', 'gmail', 'moodle'],
  summary:
    'The school websites APCS students use, what each one is for and which account signs in to it. Every other guide sends you to one of these sites.',
  when: {
    text: 'When you start the program, and whenever you forget a password or are not sure which site to use. For each new cohort, the special programs (Chương trình đề án) post a notice about student accounts under Thông báo Giáo vụ (academic announcements).',
    announcement: {
      label: 'Academic announcements, Chương trình đề án (in Vietnamese)',
      url: 'https://www.ctda.hcmus.edu.vn/vi/category/thong-bao/tb-giao-vu/',
    },
  },
  appliesTo: 'Students of the Advanced Program in Computer Science (APCS).',
  portal: {
    name: 'Portal Chương trình đề án (special programs portal)',
    url: 'https://portal.ctdb.hcmus.edu.vn',
    account: 'Your student ID and your special programs portal password',
  },
  prepare: [
    {
      text: 'The notice about student accounts for your cohort. It gives the user name and first password of the portal, Moodle and your student email.',
      link: {
        label: 'Example: the account notice for the 2023 cohort, Chương trình Tiên tiến (in Vietnamese)',
        url: 'https://www.ctda.hcmus.edu.vn/vi/2023/09/chuong-trinh-tien-tien_thong-bao-ve-viec-su-dung-tai-khoan-hoc-vu-khoa-2023/',
      },
    },
  ],
  steps: [
    { text: 'Open the special programs portal. Enter your student ID in “Username:” and your password in “Password:”, then press “Login”.' },
    { text: 'The first time you sign in, change the first password to one of your own: click your name above the menu, then “My Account”, then “Manage Password”. Enter “Current Password:”, “New Password:” and “Confirm Password:”, then press “Change Password”.' },
    {
      text: 'If you forget your portal password: open the “Forget Password” page, type your student ID in the box, then press “Gửi yêu cầu” (Send request). The portal sends a link to set a new password to the email address saved in your portal account (“Email Address:” under “Manage Account”).',
      link: { label: 'The portal’s “Forget Password” page', url: 'https://portal.ctdb.hcmus.edu.vn/forget-password' },
    },
    { text: 'If you still cannot sign in to the portal, email admin@ctdb.hcmus.edu.vn, the address the “Forget Password” page gives for sign-in problems.' },
    {
      text: 'On Moodle CTDA, enter your student ID in “Tên tài khoản” (User name) and your Moodle password in “Mật khẩu” (Password), then press “Đăng nhập” (Sign in). If you forget your Moodle password, press “Quên mật khẩu?” (Forgotten your password?).',
    },
  ],
  notes: [
    {
      text: 'Never give the password of any of these sites to anyone, OmniCourse included. OmniCourse is an unofficial site made by students: it only links to the school’s sites and never asks for your password.',
      source: { kind: 'team' },
    },
    {
      text: 'The school portal (portal.hcmus.edu.vn) and the special programs portal (portal.ctdb.hcmus.edu.vn) are different sites. APCS students register for courses on the special programs portal. Their grades show on both.',
      source: { kind: 'team' },
    },
  ],
  related: [
    { label: 'Register for courses', url: '/guides/register-courses' },
    { label: 'Pay tuition', url: '/guides/pay-tuition' },
    { label: 'View your grades', url: '/guides/grades-and-transcript' },
  ],
  // The board (guides plan §5 G01): every site the other guides send an APCS student to.
  portals: [
    {
      name: 'Portal Chương trình đề án (special programs portal)',
      url: 'https://portal.ctdb.hcmus.edu.vn',
      account: 'Your student ID and your special programs portal password',
      purpose: 'Register for courses, check your registration and see your grades.',
    },
    {
      name: 'Thu học phí online (online tuition)',
      url: 'https://hocphi.hcmus.edu.vn',
      account: 'Your student ID and the password of the online tuition site',
      purpose: 'See the tuition you owe and pay it online.',
    },
    {
      name: 'Moodle CTDA',
      url: 'https://courses.ctda.hcmus.edu.vn',
      account: 'Your student ID and your Moodle password',
      purpose: 'The online learning site (Moodle) of your course classes.',
    },
    {
      name: 'APCS student email',
      url: 'https://mail.google.com/a/apcs.fitus.edu.vn',
      account: 'The @apcs.fitus.edu.vn address the program gives you, and its password',
      purpose: 'The student email of the Chương trình Tiên tiến (APCS), run on Gmail.',
    },
    {
      name: 'Chương trình đề án website (special programs)',
      url: 'https://www.ctda.hcmus.edu.vn',
      account: 'No account needed',
      purpose: 'Announcements of the special programs: academic affairs, the academic year plan, tuition. In Vietnamese.',
    },
    {
      name: 'Portal của Trường (school portal)',
      url: 'https://portal.hcmus.edu.vn',
      account: 'Your student ID and your school portal password. Signing in also asks you to confirm with your school student email (@student.hcmus.edu.vn).',
      purpose: 'The school-wide portal. It also shows your grades, but APCS students register for courses on the special programs portal, not here.',
    },
    {
      name: 'Thư viện (library)',
      url: 'https://glib.hcmus.edu.vn',
      account: 'Your library account: the user name is 12000 followed by your student ID',
      purpose: 'The school library: search for books and documents.',
    },
  ],
} satisfies GuideFile;
