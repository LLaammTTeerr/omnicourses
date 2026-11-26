import type { GuideFile } from '../guide-file.js';

// G06 Pay tuition (guides plan §4, §5). Sources: the school's "Tài liệu hướng dẫn nộp học phí
// online" (linked from the hocphi.hcmus.edu.vn sign-in page), Quy chế đào tạo QĐ 1175/QĐ-KHTN
// and QĐ 2165/QĐ-KHTN. The payment steps come from the site itself: that PDF still shows the older
// VNPAY-only flow. Draft until a team member follows it on the portal; then set lastChecked
// and status 'published' (README.md in this folder). Search expectations: GUIDE-01c.
export default {
  id: 'pay-tuition',
  lang: 'vi',
  status: 'draft',
  version: 1,
  changeNote:
    'Bản đầu tiên. Chưa kiểm tra hết: ngày kiểm tra không còn khoản phải nộp, nên nút bắt đầu thanh toán và các bước ở từng trang thanh toán (các bước ghi CHECK) chờ đến đợt thu học phí tới.',
  // Partly followed on 15 Nov 2026 (Dũng). Set when every step has been followed on the portal.
  lastChecked: null,
  group: 'tuition-and-fees',
  title: 'Đóng học phí',
  keywords: ['học phí', 'đóng học phí', 'nộp học phí', 'hocphi', 'vnpay', 'vietqr', 'viettel money', 'hóa đơn học phí', 'gia hạn học phí'],
  summary:
    'Mỗi học kỳ, sinh viên xem số học phí phải đóng và nộp trực tuyến trên trang Thu học phí online của Trường. Sinh viên nào cũng phải đóng đủ trong thời gian Trường thông báo.',
  when: {
    text: 'Mỗi học kỳ, trong thời gian thu học phí ghi ở thông báo của học kỳ đó. Chương trình đề án đăng các thông báo này ở mục Thông báo Kế toán - Tài chính.',
    announcement: {
      label: 'Thông báo Kế toán - Tài chính, Chương trình đề án',
      url: 'https://www.ctda.hcmus.edu.vn/vi/category/thong-bao/tb-ke-toan/',
    },
  },
  appliesTo: 'Sinh viên đại học hệ chính quy, trong đó có sinh viên chương trình Tiên tiến (APCS).',
  portal: {
    name: 'Thu học phí online',
    url: 'https://hocphi.hcmus.edu.vn',
    account: 'Mã số sinh viên và mật khẩu của trang Thu học phí online',
  },
  prepare: [
    {
      text: 'Mã số sinh viên và mật khẩu của trang Thu học phí online. Mật khẩu lần đầu được ghi trong tài liệu hướng dẫn của Trường. Sau khi đăng nhập, đổi mật khẩu bằng nút “Đổi mật khẩu”.',
      link: {
        label: 'Tài liệu hướng dẫn nộp học phí online',
        url: 'https://hocphi.hcmus.edu.vn/Content/TLHD_ThuHocPhiOnline_KHTN.pdf',
      },
    },
    {
      text: 'Một cách thanh toán: ứng dụng ngân hàng quét được mã VNPAY-QR hoặc VietQR, ví Viettel Money, thẻ ATM hoặc tài khoản ngân hàng nội địa, hoặc thẻ quốc tế (Visa, MasterCard hoặc JCB).',
    },
  ],
  steps: [
    { text: 'Mở trang Thu học phí online. Nhập “Mã số sinh viên” và “Mật khẩu”, rồi bấm “Đăng nhập”.' },
    {
      text: 'Ở thẻ “Các khoản thu cần nộp”, xem “Năm học”, “Học kỳ” và số tiền ở cột “Còn lại (đ)”. Mọi khoản còn nợ đã được chọn sẵn để thanh toán.',
    },
    {
      text: '[CHECK: nút bắt đầu thanh toán; nút chỉ hiện khi còn khoản phải nộp] Trang mở hộp “Chọn phương thức thanh toán”.',
    },
    {
      text: 'Chọn một cách: “Quét mã VNPAY-QR”, “Thẻ ATM & Tài khoản ngân hàng nội địa”, “Thẻ thanh toán quốc tế (Visa / MasterCard / JCB)”, “Cổng thanh toán Viettel Money” hoặc “Chuyển khoản nhanh VietQR”. Mỗi cách có ghi phí. Rồi bấm “Tiếp tục thanh toán”.',
    },
    {
      text: 'Thanh toán ở trang vừa mở, và không đóng trình duyệt cho đến khi trang báo kết quả giao dịch. [CHECK: các bước ở từng trang thanh toán]',
    },
    {
      text: 'Quay lại trang Thu học phí online, mở thẻ “Các khoản thu đã nộp” và kiểm tra khoản vừa nộp có trong danh sách. Tải hóa đơn điện tử bằng nút “Tải hóa đơn”.',
    },
    {
      text: 'Nếu giao dịch chờ xác nhận quá 15 phút, mở thẻ “Lịch sử giao dịch” và xem cột “Trạng thái”, hoặc liên hệ Phòng Kế hoạch – Tài chính.',
    },
  ],
  notes: [
    {
      text: 'Không hoàn thành nghĩa vụ học phí đúng thời gian quy định là một trong các trường hợp bị buộc thôi học.',
      source: {
        kind: 'regulation',
        document: 'Quy chế đào tạo trình độ đại học (Quyết định 1175/QĐ-KHTN)',
        clause: 'Điều 16, khoản 2, điểm a',
        url: 'https://www.ctda.hcmus.edu.vn/wp-content/uploads/2023/03/Quy-che-dao-tao-2021.pdf',
      },
    },
    {
      text: 'Nếu không thể nộp đúng hạn vì đang chờ khoản vay sinh viên, vì gia đình khó khăn có xác nhận của chính quyền địa phương, hoặc vì bạn hay người thân phải nằm viện, bạn có thể xin gia hạn. Nộp đơn có chữ ký của bạn và xác nhận của phụ huynh, kèm giấy tờ chứng minh, tại Phòng Kế hoạch – Tài chính, ít nhất 7 ngày làm việc trước ngày kết thúc thu học phí.',
      source: {
        kind: 'regulation',
        document: 'Quy định gia hạn thời gian nộp học phí (Quyết định 2165/QĐ-KHTN)',
        clause: 'Điều 2, Điều 3 và Điều 4',
        url: 'https://hcmus.edu.vn/wp-content/uploads/2025/10/QD-so-2165_QD-gia-han-dong-hoc-phi_KHTN.pdf',
      },
    },
    {
      text: 'Giữ hóa đơn điện tử hoặc ảnh chụp kết quả giao dịch cho đến khi khoản đã nộp hiện trong “Các khoản thu đã nộp”.',
      source: { kind: 'team' },
    },
  ],
  related: [{ label: 'Đăng ký học phần', url: '/guides/register-courses' }],
} satisfies GuideFile;
