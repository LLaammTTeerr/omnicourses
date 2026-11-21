import type { GroupId } from '../groups.js';

// The landing page's words (HomeView.vue), in both languages.

interface Feature {
  group: GroupId;
  glyph: string;
  title: string;
  text: string;
  soon?: boolean;
}

export const HOME_MESSAGES = {
  vi: {
    eyebrow: 'Cho sinh viên HCMUS · APCS trước tiên',
    title: 'Biết chính xác còn thiếu gì để tốt nghiệp.',
    lead: 'Một chỗ cho bảng điểm, tiến độ từng nhóm tín chỉ và các thủ tục ở trường. Mọi quy chế do rule engine tính, không phải AI.',
    start: 'Bắt đầu miễn phí',
    open: 'Mở tổng quan',
    readGuides: 'Đọc hướng dẫn thủ tục',
    noPortal: 'Không cần mật khẩu cổng trường. Dữ liệu là do bạn nhập.',
    stage: '8 nhóm tín chỉ, mỗi nhóm một màu và một ký hiệu.',
    featuresTitle: 'Mọi thứ về việc học, xếp gọn trong một màn hình.',
    soon: 'Sắp có',
    features: [
      { group: 'phys', glyph: '↗', title: 'Hướng dẫn thủ tục', text: 'Đăng ký học phần, đóng học phí, tải bảng điểm. Link thẳng tới cổng, các bước, ngày kiểm tra gần nhất. Đọc được khi chưa đăng nhập.' },
      { group: 'gen', glyph: '≡', title: 'Bảng điểm của bạn', text: 'Nhập từng môn, duyệt từng dòng rồi lưu. Dòng chưa đủ thông tin không lưu được. Lưu lần sau thay toàn bộ lần trước.' },
      { group: 'thesis', glyph: '⇣', title: 'Dữ liệu là của bạn', text: 'Tải toàn bộ dữ liệu về một file JSON, hoặc xóa tài khoản bất cứ lúc nào.' },
      { group: 'core', glyph: '%', title: 'Xét tốt nghiệp theo từng nhóm', text: '8 nhóm tín chỉ, mỗi nhóm một màu. Đã đạt, đang học, còn thiếu, theo đúng quy chế.' },
      { group: 'elec', glyph: '⇄', title: 'Lộ trình kéo thả', text: 'Kéo môn vào học kỳ. Tiên quyết, kỳ mở môn và giới hạn tín chỉ được kiểm tra ngay khi thả.', soon: true },
      { group: 'pol', glyph: '?', title: 'Trợ lý có trích dẫn', text: 'Mỗi câu trả lời kèm điều khoản. Việc liên quan hồ sơ của bạn do rule engine kiểm tra.', soon: true },
    ] satisfies Feature[],
    promiseTitle: 'Ba điều không bao giờ làm.',
    promises: [
      { group: 'pol', title: 'Không để AI quyết định quy chế', text: 'Tiên quyết, giới hạn tín chỉ, điều kiện tốt nghiệp chỉ do rule engine tính.' },
      { group: 'core', title: 'Không giữ mật khẩu cổng trường', text: 'Không đăng ký hộ, không đọc trang portal. Chỉ có link và dữ liệu bạn tự nhập.' },
      { group: 'eng', title: 'Không gửi tên hay MSSV cho AI', text: 'Trợ lý chỉ nhận mã môn, điểm, học kỳ, và chỉ sau khi bạn đồng ý.' },
    ] satisfies { group: GroupId; title: string; text: string }[],
    ctaTitle: 'Kỳ đăng ký sắp tới, chuẩn bị bảng điểm trước đã.',
    ctaText: 'Tài khoản miễn phí. Xóa toàn bộ dữ liệu bất cứ lúc nào.',
    cta: 'Tạo tài khoản',
    status: 'Trạng thái hệ thống',
  },
  en: {
    eyebrow: 'For HCMUS students · APCS first',
    title: 'Know exactly what you still need to graduate.',
    lead: 'One place for your transcript, your progress in each credit group and the tasks at school. Every academic rule is computed by the rule engine, not by AI.',
    start: 'Get started free',
    open: 'Open your dashboard',
    readGuides: 'Read the school task guides',
    noPortal: 'No school portal password needed. You enter your own data.',
    stage: '8 credit groups, each with its own colour and glyph.',
    featuresTitle: 'Everything about your studies, on one screen.',
    soon: 'Coming soon',
    features: [
      { group: 'phys', glyph: '↗', title: 'School task guides', text: 'Register for courses, pay tuition, download your transcript. A direct link to the portal, the steps and the date they were last checked. Readable without an account.' },
      { group: 'gen', glyph: '≡', title: 'Your transcript', text: 'Enter each course, review every row, then save. An incomplete row cannot be saved. A later save replaces the earlier one.' },
      { group: 'thesis', glyph: '⇣', title: 'Your data is yours', text: 'Download everything as one JSON file, or delete your account at any time.' },
      { group: 'core', glyph: '%', title: 'Degree audit by group', text: '8 credit groups, one colour each. Passed, in progress and still needed, by the regulation.' },
      { group: 'elec', glyph: '⇄', title: 'Drag-and-drop roadmap', text: 'Drag a course into a term. Prerequisites, offering terms and credit caps are checked as you drop.', soon: true },
      { group: 'pol', glyph: '?', title: 'An advisor that cites', text: 'Every answer cites its clause. Anything about your record is checked by the rule engine.', soon: true },
    ] satisfies Feature[],
    promiseTitle: 'Three things we never do.',
    promises: [
      { group: 'pol', title: 'AI never decides a rule', text: 'Prerequisites, credit caps and graduation status are computed only by the rule engine.' },
      { group: 'core', title: 'We never hold your portal password', text: 'No registering on your behalf, no reading portal pages. Only links and the data you enter.' },
      { group: 'eng', title: 'Your name and student ID never reach an AI', text: 'The advisor only gets course codes, grades and terms, and only after you agree.' },
    ] satisfies { group: GroupId; title: string; text: string }[],
    ctaTitle: 'Registration is coming: get your transcript ready first.',
    ctaText: 'Free account. Delete all your data at any time.',
    cta: 'Create account',
    status: 'System status',
  },
};
