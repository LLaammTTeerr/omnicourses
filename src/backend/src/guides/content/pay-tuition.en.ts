import type { GuideFile } from '../guide-file.js';

// G06 Pay tuition (guides plan §4, §5). Sources: the school's "Tài liệu hướng dẫn nộp học phí
// online" (linked from the hocphi.hcmus.edu.vn sign-in page), Quy chế đào tạo QĐ 1175/QĐ-KHTN
// and QĐ 2165/QĐ-KHTN. The payment steps come from the site itself: that PDF still shows the older
// VNPAY-only flow. Draft until a team member follows it on the portal; then set lastChecked
// and status 'published' (README.md in this folder). Search expectations: GUIDE-01c.
export default {
  id: 'pay-tuition',
  lang: 'en',
  status: 'draft',
  version: 1,
  changeNote:
    'First version. Not checked to the end: nothing was owed on the day of the check, so the button that starts the payment and the steps on each payment page (the steps marked CHECK) wait for the next tuition period.',
  // Partly followed on 15 Nov 2026 (Dũng). Set when every step has been followed on the portal.
  lastChecked: null,
  group: 'tuition-and-fees',
  title: 'Pay tuition',
  keywords: ['tuition', 'pay tuition', 'tuition fees', 'hocphi', 'vnpay', 'vietqr', 'viettel money', 'tuition invoice', 'tuition extension'],
  summary:
    'Each term, students check the tuition they owe and pay it online on the school’s Thu học phí online (online tuition) site. Every student must pay in full within the period the school announces.',
  when: {
    text: 'Each term, within the tuition collection period given in that term’s announcement. The special programs (Chương trình đề án) post these announcements under Thông báo Kế toán - Tài chính (finance announcements).',
    announcement: {
      label: 'Finance announcements, Chương trình đề án (in Vietnamese)',
      url: 'https://www.ctda.hcmus.edu.vn/vi/category/thong-bao/tb-ke-toan/',
    },
  },
  appliesTo: 'Full-time undergraduate students, including students of the Advanced Program in Computer Science (APCS).',
  portal: {
    name: 'Thu học phí online (online tuition)',
    url: 'https://hocphi.hcmus.edu.vn',
    account: 'Your student ID and the password of the online tuition site',
  },
  prepare: [
    {
      text: 'Your student ID and the password of the online tuition site. The first password is given in the school’s guide. After you sign in, change it with “Đổi mật khẩu” (Change password).',
      link: {
        label: 'The school’s online tuition guide (in Vietnamese)',
        url: 'https://hocphi.hcmus.edu.vn/Content/TLHD_ThuHocPhiOnline_KHTN.pdf',
      },
    },
    {
      text: 'One way to pay: a banking app that scans VNPAY-QR or VietQR codes, a Viettel Money wallet, a domestic ATM card or bank account, or an international card (Visa, MasterCard or JCB).',
    },
  ],
  steps: [
    { text: 'Open the online tuition site. Enter “Mã số sinh viên” (Student ID) and “Mật khẩu” (Password), then press “Đăng nhập” (Sign in).' },
    {
      text: 'On the “Các khoản thu cần nộp” (Amounts to pay) tab, check the academic year (“Năm học”), the term (“Học kỳ”) and the amount in the “Còn lại (đ)” (Remaining) column. Every amount you owe is already selected for payment.',
    },
    {
      text: '[CHECK: the button that starts the payment; it only shows when you owe tuition] The site opens a “Chọn phương thức thanh toán” (Choose a payment method) box.',
    },
    {
      text: 'Choose one: “Quét mã VNPAY-QR” (scan a VNPAY-QR code), “Thẻ ATM & Tài khoản ngân hàng nội địa” (domestic ATM card or bank account), “Thẻ thanh toán quốc tế (Visa / MasterCard / JCB)” (international card), “Cổng thanh toán Viettel Money” (Viettel Money) or “Chuyển khoản nhanh VietQR” (VietQR bank transfer). Each choice shows its fee. Then press “Tiếp tục thanh toán” (Continue to payment).',
    },
    {
      text: 'Pay on the page that opens, and keep the browser open until it shows the result of the payment. [CHECK: the steps on each payment page]',
    },
    {
      text: 'Go back to the online tuition site, open the “Các khoản thu đã nộp” (Amounts paid) tab and check that your payment is listed. Download the e-invoice with “Tải hóa đơn” (Download invoice).',
    },
    {
      text: 'If a payment is still waiting for confirmation after 15 minutes, open the “Lịch sử giao dịch” (Transaction history) tab and look at “Trạng thái” (Status), or contact Phòng Kế hoạch – Tài chính (the Planning and Finance Office).',
    },
  ],
  notes: [
    {
      text: 'A student who does not pay tuition within the required time is one of the cases that are expelled.',
      source: {
        kind: 'regulation',
        document: 'Quy chế đào tạo trình độ đại học (Decision 1175/QĐ-KHTN, in Vietnamese)',
        clause: 'Article 16, clause 2, point a',
        url: 'https://www.ctda.hcmus.edu.vn/wp-content/uploads/2023/03/Quy-che-dao-tao-2021.pdf',
      },
    },
    {
      text: 'If you cannot pay on time because you are waiting for a student loan, because your family is in hardship confirmed by the local authority, or because you or a family member is in hospital, you may ask for an extension. Hand in the request, signed by you and confirmed by a parent, with the supporting papers, at Phòng Kế hoạch – Tài chính (the Planning and Finance Office), at least 7 working days before tuition collection ends.',
      source: {
        kind: 'regulation',
        document: 'Quy định gia hạn thời gian nộp học phí (Decision 2165/QĐ-KHTN, in Vietnamese)',
        clause: 'Articles 2, 3 and 4',
        url: 'https://hcmus.edu.vn/wp-content/uploads/2025/10/QD-so-2165_QD-gia-han-dong-hoc-phi_KHTN.pdf',
      },
    },
    {
      text: 'Keep the e-invoice or a screenshot of the payment result until the payment appears under “Các khoản thu đã nộp” (Amounts paid).',
      source: { kind: 'team' },
    },
  ],
  related: [{ label: 'Register for courses', url: '/guides/register-courses' }],
} satisfies GuideFile;
