import type { GuideFile } from '../guide-file.js';

// G02 Register for courses (guides plan §4, §5). Sources: the sign-in page of
// portal.ctdb.hcmus.edu.vn, the school's notices on registration and student accounts
// (Chương trình đề án, 2022–2024) and Quy chế đào tạo QĐ 1175/QĐ-KHTN. Draft until a team member
// follows it on the portal; every "[CHECK: …]" is confirmed or removed first. Then set lastChecked
// and status 'published' (README.md in this folder). Search expectations: B1 test cases, GUIDE-01c.
export default {
  id: 'register-courses',
  lang: 'vi',
  status: 'draft',
  version: 1,
  changeNote:
    'Bản đầu tiên. Chưa kiểm tra hết: ngày kiểm tra đang ngoài thời gian đăng ký, nên các bước tìm học phần, chọn lớp, cảnh báo trùng giờ, xác nhận, hủy và cách hiện học phần học lại (các bước ghi CHECK) chờ đến đợt đăng ký tới.',
  lastChecked: { on: '2026-11-15', by: 'Dũng' },
  group: 'registration',
  title: 'Đăng ký học phần',
  keywords: ['đăng ký học phần', 'dkhp', 'đkhp', 'đăng ký môn học', 'kết quả đkhp', 'học lại'],
  summary:
    'Mỗi học kỳ chính, sinh viên đăng ký các học phần sẽ học trên Portal Chương trình đề án, trong thời gian Chương trình đề án thông báo, rồi kiểm tra kết quả đăng ký.',
  when: {
    text: 'Mỗi học kỳ chính, trong thời gian đăng ký ghi ở thông báo của học kỳ đó. Chương trình đề án đăng các thông báo này ở mục Thông báo Giáo vụ.',
    announcement: {
      label: 'Thông báo Giáo vụ, Chương trình đề án',
      url: 'https://www.ctda.hcmus.edu.vn/vi/category/thong-bao/tb-giao-vu/',
    },
  },
  appliesTo: 'Sinh viên chương trình Tiên tiến (APCS).',
  portal: {
    name: 'Portal Chương trình đề án',
    url: 'https://portal.ctdb.hcmus.edu.vn/dang-ky-hoc-phan/sinh-vien-apcs',
    account: 'Mã số sinh viên và mật khẩu Portal Chương trình đề án',
  },
  prepare: [
    {
      text: 'Các học phần sẽ mở trong năm học, để chọn học phần cho học kỳ tới.',
      link: { label: 'Kế hoạch học tập, Chương trình đề án', url: 'https://www.ctda.hcmus.edu.vn/vi/category/thong-bao/ke-hoach-hoc-tap/' },
    },
    {
      text: 'Thông báo đăng ký học phần của học kỳ: thời gian đăng ký, danh sách học phần mở và lớp học phần.',
    },
    {
      text: 'Mã các học phần bạn định đăng ký. Số tín chỉ tối thiểu và tối đa mỗi học kỳ tùy chương trình đào tạo: xem ghi chú bên dưới.',
    },
    {
      text: 'Tài khoản Portal Chương trình đề án. Nếu quên mật khẩu, xem hướng dẫn về tài khoản.',
      link: { label: 'Tài khoản và cổng thông tin', url: '/guides/accounts-and-portals' },
    },
  ],
  steps: [
    { text: 'Mở Portal Chương trình đề án. Nhập mã số sinh viên vào “Username:” và mật khẩu vào “Password:”, rồi bấm “Login”.' },
    { text: 'Trên menu, chọn “SINH VIÊN” → “Đăng Ký Học Phần” → “Sinh viên CTTT”. Ngoài thời gian đăng ký, trang báo “Đã hết thời gian đăng ký học phần!”.' },
    { text: '[CHECK: cách tìm học phần theo mã, nhãn ô tìm kiếm]' },
    {
      text: 'Chọn lớp học phần theo danh sách chia lớp trong thông báo đăng ký, để không bị trùng giờ. [CHECK: nhãn chọn lớp; cảnh báo trùng giờ trông thế nào]',
    },
    { text: '[CHECK: nút xác nhận đăng ký; cách hủy một học phần trong thời gian đăng ký]' },
    {
      text: 'Kiểm tra kết quả: chọn “SINH VIÊN” → “Đăng Ký Học Phần” → “Kết Quả ĐKHP”, rồi chọn học kỳ trong danh sách. Xem có đủ các học phần (“Mã MH”), đúng lớp (“Lớp HP”), và không có hai lớp trùng giờ (“Lịch LT” và “Lịch TH”).',
    },
    { text: '[CHECK: học phần học lại hoặc học cải thiện hiện thế nào sau khi đăng ký; nút “Cập nhật tình trạng học lại/cải thiện” ở “Kết Quả ĐKHP” bị ẩn ngoài thời gian đăng ký]' },
    { text: 'Sau khi hết thời gian đăng ký, mở lại “Kết Quả ĐKHP” để xem kết quả cuối cùng.' },
  ],
  notes: [
    {
      text: 'Số tín chỉ tối thiểu và tối đa được đăng ký trong một học kỳ tùy chương trình đào tạo. Muốn đăng ký nhiều hơn mức tối đa hoặc ít hơn mức tối thiểu, bạn phải làm đơn đề nghị, được Khoa đồng ý và Hiệu trưởng chấp thuận.',
      source: {
        kind: 'regulation',
        document: 'Quy chế đào tạo trình độ đại học (Quyết định 1175/QĐ-KHTN)',
        clause: 'Điều 7, khoản 2',
        url: 'https://www.ctda.hcmus.edu.vn/wp-content/uploads/2023/03/Quy-che-dao-tao-2021.pdf',
      },
    },
    {
      text: 'Chương trình Tiên tiến có ba học kỳ chính mỗi năm học, nên học kỳ 3 cũng là học kỳ chính, không phải học kỳ hè.',
      source: {
        kind: 'regulation',
        document: 'Quy chế đào tạo trình độ đại học (Quyết định 1175/QĐ-KHTN)',
        clause: 'Điều 6, khoản 4, điểm b',
        url: 'https://www.ctda.hcmus.edu.vn/wp-content/uploads/2023/03/Quy-che-dao-tao-2021.pdf',
      },
    },
    {
      text: 'Học phần không đạt phải được đăng ký học lại. Với học phần tự chọn không đạt, bạn có thể học lại hoặc chọn một học phần tự chọn khác trong chương trình để thay thế.',
      source: {
        kind: 'regulation',
        document: 'Quy chế đào tạo trình độ đại học (Quyết định 1175/QĐ-KHTN)',
        clause: 'Điều 14, khoản 1',
        url: 'https://www.ctda.hcmus.edu.vn/wp-content/uploads/2023/03/Quy-che-dao-tao-2021.pdf',
      },
    },
    {
      text: 'Đã đăng ký học phần mà không đi học thì bị xem như tự ý bỏ học và nhận điểm không cho học phần đó. Theo dõi kết quả đăng ký để xác nhận, hoặc điều chỉnh trong đợt điều chỉnh của học kỳ.',
      source: {
        kind: 'regulation',
        document: 'Quy chế đào tạo trình độ đại học (Quyết định 1175/QĐ-KHTN)',
        clause: 'Điều 7, khoản 1, điểm d; khoản 3 và khoản 4',
        url: 'https://www.ctda.hcmus.edu.vn/wp-content/uploads/2023/03/Quy-che-dao-tao-2021.pdf',
      },
    },
    {
      text: 'Lớp học phần có ít sinh viên đăng ký hơn số tối thiểu Trường quy định thì không được mở.',
      source: {
        kind: 'regulation',
        document: 'Quy chế đào tạo trình độ đại học (Quyết định 1175/QĐ-KHTN)',
        clause: 'Điều 8, khoản 3, điểm a',
        url: 'https://www.ctda.hcmus.edu.vn/wp-content/uploads/2023/03/Quy-che-dao-tao-2021.pdf',
      },
    },
    {
      text: 'Nếu lớp đã đầy hoặc không được mở, chờ đợt điều chỉnh đăng ký của học kỳ, hoặc hỏi Giáo vụ qua giaovu@apcs.fitus.edu.vn. [CHECK: lớp đầy hiện thế nào trên Portal]',
      source: { kind: 'team' },
    },
  ],
  related: [
    { label: 'Đóng học phí', url: '/guides/pay-tuition' },
    { label: 'Xem điểm', url: '/guides/grades-and-transcript' },
  ],
} satisfies GuideFile;
