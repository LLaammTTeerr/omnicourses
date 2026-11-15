import type { GuideFile } from '../guide-file.js';

// G01 Your school accounts and portals (guides plan §4, §5). Sources: the sign-in and
// "Forget Password" pages of portal.ctdb.hcmus.edu.vn, the sign-in page of Moodle CTDA, and the
// school's notice on student accounts for the Chương trình Tiên tiến 2023 cohort. The rest comes
// from following it on the portal (lastChecked). Search expectations: GUIDE-01c.
export default {
  id: 'accounts-and-portals',
  lang: 'vi',
  status: 'published',
  version: 1,
  changeNote: 'Bản đầu tiên.',
  lastChecked: { on: '2026-11-15', by: 'Dũng' },
  group: 'accounts-and-portals',
  title: 'Tài khoản và cổng thông tin',
  keywords: ['tài khoản', 'cổng thông tin', 'portal', 'mật khẩu', 'quên mật khẩu', 'đăng nhập', 'email sinh viên', 'moodle'],
  summary:
    'Các trang web của Trường mà sinh viên APCS dùng, mỗi trang để làm gì và đăng nhập bằng tài khoản nào. Các hướng dẫn khác đều dẫn bạn đến một trong các trang này.',
  when: {
    text: 'Khi bắt đầu khóa học, và mỗi khi bạn quên mật khẩu hoặc không biết nên vào trang nào. Mỗi khóa mới, Chương trình đề án đăng thông báo về tài khoản học vụ ở mục Thông báo Giáo vụ.',
    announcement: {
      label: 'Thông báo Giáo vụ, Chương trình đề án',
      url: 'https://www.ctda.hcmus.edu.vn/vi/category/thong-bao/tb-giao-vu/',
    },
  },
  appliesTo: 'Sinh viên chương trình Tiên tiến (APCS).',
  portal: {
    name: 'Portal Chương trình đề án',
    url: 'https://portal.ctdb.hcmus.edu.vn',
    account: 'Mã số sinh viên và mật khẩu Portal Chương trình đề án',
  },
  prepare: [
    {
      text: 'Thông báo về tài khoản học vụ của khóa bạn. Thông báo ghi tên đăng nhập và mật khẩu lần đầu của Portal, Moodle và email sinh viên.',
      link: {
        label: 'Ví dụ: thông báo tài khoản học vụ Khóa 2023, chương trình Tiên tiến',
        url: 'https://www.ctda.hcmus.edu.vn/vi/2023/09/chuong-trinh-tien-tien_thong-bao-ve-viec-su-dung-tai-khoan-hoc-vu-khoa-2023/',
      },
    },
  ],
  steps: [
    { text: 'Mở Portal Chương trình đề án. Nhập mã số sinh viên vào “Username:” và mật khẩu vào “Password:”, rồi bấm “Login”.' },
    { text: 'Lần đầu đăng nhập, đổi mật khẩu lần đầu sang mật khẩu của riêng bạn: bấm vào tên của bạn phía trên thanh menu, chọn “My Account”, rồi chọn “Manage Password”. Nhập “Current Password:” (mật khẩu hiện tại), “New Password:” (mật khẩu mới) và “Confirm Password:” (nhập lại mật khẩu mới), rồi bấm “Change Password”.' },
    {
      text: 'Nếu quên mật khẩu Portal: mở trang “Forget Password”, nhập mã số sinh viên vào ô trên trang, rồi bấm “Gửi yêu cầu”. Portal gửi liên kết đặt mật khẩu mới đến địa chỉ email lưu trong tài khoản Portal của bạn (“Email Address:” ở mục “Manage Account”).',
      link: { label: 'Trang “Forget Password” của Portal', url: 'https://portal.ctdb.hcmus.edu.vn/forget-password' },
    },
    { text: 'Nếu vẫn không đăng nhập được Portal, gửi email đến admin@ctdb.hcmus.edu.vn, địa chỉ mà trang “Forget Password” ghi cho các vấn đề đăng nhập.' },
    {
      text: 'Ở Moodle CTDA, nhập mã số sinh viên vào “Tên tài khoản” và mật khẩu Moodle vào “Mật khẩu”, rồi bấm “Đăng nhập”. Nếu quên mật khẩu Moodle, bấm “Quên mật khẩu?”.',
    },
  ],
  notes: [
    {
      text: 'Không đưa mật khẩu của các trang này cho bất kỳ ai, kể cả OmniCourse. OmniCourse là trang không chính thức do sinh viên làm: chỉ dẫn link đến trang của Trường và không bao giờ hỏi mật khẩu của bạn.',
      source: { kind: 'team' },
    },
    {
      text: 'Portal của Trường (portal.hcmus.edu.vn) và Portal Chương trình đề án (portal.ctdb.hcmus.edu.vn) là hai trang khác nhau. Sinh viên APCS đăng ký học phần ở Portal Chương trình đề án. Điểm hiện ở cả hai trang.',
      source: { kind: 'team' },
    },
  ],
  related: [
    { label: 'Đăng ký học phần', url: '/guides/register-courses' },
    { label: 'Đóng học phí', url: '/guides/pay-tuition' },
    { label: 'Xem điểm', url: '/guides/grades-and-transcript' },
  ],
  // The board (guides plan §5 G01): every site the other guides send an APCS student to.
  portals: [
    {
      name: 'Portal Chương trình đề án',
      url: 'https://portal.ctdb.hcmus.edu.vn',
      account: 'Mã số sinh viên và mật khẩu Portal Chương trình đề án',
      purpose: 'Đăng ký học phần, xem kết quả đăng ký và xem điểm.',
    },
    {
      name: 'Thu học phí online',
      url: 'https://hocphi.hcmus.edu.vn',
      account: 'Mã số sinh viên và mật khẩu của trang Thu học phí online',
      purpose: 'Xem số học phí phải đóng và nộp học phí trực tuyến.',
    },
    {
      name: 'Moodle CTDA',
      url: 'https://courses.ctda.hcmus.edu.vn',
      account: 'Mã số sinh viên và mật khẩu Moodle',
      purpose: 'Trang học trực tuyến (Moodle) của các lớp học phần.',
    },
    {
      name: 'Email sinh viên APCS',
      url: 'https://mail.google.com/a/apcs.fitus.edu.vn',
      account: 'Địa chỉ email @apcs.fitus.edu.vn do Chương trình cấp và mật khẩu của nó',
      purpose: 'Email sinh viên của chương trình Tiên tiến, chạy trên Gmail.',
    },
    {
      name: 'Trang Chương trình đề án',
      url: 'https://www.ctda.hcmus.edu.vn',
      account: 'Không cần tài khoản',
      purpose: 'Thông báo của Chương trình đề án: giáo vụ, kế hoạch năm học, học phí.',
    },
    {
      name: 'Portal của Trường',
      url: 'https://portal.hcmus.edu.vn',
      account: 'Mã số sinh viên và mật khẩu Portal của Trường. Khi đăng nhập, bạn cần xác thực thêm bằng email sinh viên của Trường (@student.hcmus.edu.vn).',
      purpose: 'Cổng thông tin chung của Trường. Trang này cũng hiện điểm, nhưng sinh viên APCS đăng ký học phần ở Portal Chương trình đề án, không phải ở đây.',
    },
    {
      name: 'Thư viện',
      url: 'https://glib.hcmus.edu.vn',
      account: 'Tài khoản thư viện: tên đăng nhập là 12000 rồi đến mã số sinh viên',
      purpose: 'Thư viện của Trường: tra cứu sách và tài liệu.',
    },
  ],
} satisfies GuideFile;
