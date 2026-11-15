import type { GuideFile } from '../guide-file.js';

// G07 View your grades (guides plan §4, §5). Sources: the sign-in page of portal.ctdb.hcmus.edu.vn
// and the school's re-mark notices (Chương trình đề án). No school page describes the grades screen,
// so those steps come from following it on the portal (lastChecked). Neither that portal nor
// portal.hcmus.edu.vn offers a transcript PDF to download, so the guide promises none. The id keeps
// its first name so links and search stay stable. Search expectations: GUIDE-01c.
export default {
  id: 'grades-and-transcript',
  lang: 'vi',
  status: 'published',
  version: 1,
  changeNote: 'Bản đầu tiên.',
  lastChecked: { on: '2026-11-15', by: 'Dũng' },
  group: 'records-and-certificates',
  title: 'Xem điểm',
  keywords: ['bảng điểm', 'xem điểm', 'kết quả học phần', 'kết quả học tập', 'điểm trung bình', 'phúc khảo', 'học lại'],
  summary:
    'Xem điểm các học phần theo từng học kỳ trên Portal Chương trình đề án. Sinh viên nào cũng cần khi muốn xem lại kết quả học tập.',
  when: {
    text: 'Sau mỗi học kỳ, khi đã có điểm. Chương trình đề án đăng thông báo về điểm và phúc khảo ở mục Thông báo Giáo vụ.',
    announcement: {
      label: 'Thông báo Giáo vụ, Chương trình đề án',
      url: 'https://www.ctda.hcmus.edu.vn/vi/category/thong-bao/tb-giao-vu/',
    },
  },
  appliesTo: 'Sinh viên chương trình Tiên tiến (APCS).',
  portal: {
    name: 'Portal Chương trình đề án',
    url: 'https://portal.ctdb.hcmus.edu.vn/sinh-vien/ket-qua-hoc-phan',
    account: 'Mã số sinh viên và mật khẩu Portal Chương trình đề án',
  },
  prepare: [
    {
      text: 'Tài khoản Portal Chương trình đề án. Nếu quên mật khẩu, xem hướng dẫn về tài khoản.',
      link: { label: 'Tài khoản và cổng thông tin', url: '/guides/accounts-and-portals' },
    },
  ],
  steps: [
    { text: 'Mở Portal Chương trình đề án. Nhập mã số sinh viên vào “Username:” và mật khẩu vào “Password:”, rồi bấm “Login”.' },
    { text: 'Trên menu, chọn “SINH VIÊN” → “Kết Quả Học Phần”.' },
    {
      text: 'Muốn xem một học kỳ, chọn học kỳ đó trong danh sách đang hiện “--Tất cả HK--”. Điểm của mỗi học phần ở cột “Điểm tổng thang 10”. Cột “Môn học lại” đánh dấu học phần bạn học lại.',
    },
    { text: 'Kiểm tra có đủ các học kỳ và học phần bạn đã học.' },
  ],
  notes: [
    {
      text: 'Cả Portal Chương trình đề án lẫn Portal của Trường đều không có nút tải bảng điểm thành tệp PDF.',
      source: { kind: 'team' },
    },
    {
      text: 'Điểm là thông tin cá nhân của bạn. Đừng đăng ảnh chụp trang này vào nhóm chat hoặc mạng xã hội.',
      source: { kind: 'team' },
    },
    {
      text: 'Nếu thấy điểm sai, làm đơn phúc khảo trong thời gian ghi ở thông báo phúc khảo của học kỳ, ở mục Thông báo Giáo vụ. Thông báo ghi rõ: sau thời gian phúc khảo, mọi khiếu nại sẽ không được giải quyết.',
      source: { kind: 'team' },
    },
  ],
  // Register for courses is linked under `related` once that guide is published (version 2).
} satisfies GuideFile;
