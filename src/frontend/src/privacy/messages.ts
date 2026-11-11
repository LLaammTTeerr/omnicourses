import type { Lang } from '../locale.js';

// The privacy notice (UC-01 step 2, Luật 91/2025/QH15). Every sentence states what the code on main does; the PR that
// changes the behaviour changes the sentence. Sources: the user tables' migrations (what is stored), ADR 0004 and
// ACCOUNT_DELETION_GRACE_DAYS (deletion), deploy/server/omnicourse-root and architecture.md "Backups" (backups),
// ADR 0003 (AI).

/** The day the text below last changed. */
export const PRIVACY_UPDATED_ON = '2026-11-12';

/** The account deletion grace period (ACCOUNT_DELETION_GRACE_DAYS, default 30 in the API and .env.example). */
export const DELETION_GRACE_DAYS = 30;

/** The pre-deploy database copies kept on the server (deploy/server/omnicourse-root: `tail -n +15`). */
export const DEPLOY_COPIES_KEPT = 14;

/** Settings' own labels, so the steps name exactly what the student sees there. */
export interface SettingsPath {
  settings: string;
  section: string;
  button: string;
}

interface PrivacyMessages {
  title: string;
  lead: string;
  updated: (date: string) => string;
  storedTitle: string;
  storedIntro: string;
  stored: string[];
  noPortalPassword: string;
  keptTitle: string;
  kept: string;
  controlTitle: string;
  exportHow: (path: SettingsPath) => string;
  deleteHow: (path: SettingsPath) => string;
  deleteGrace: string;
  backupsTitle: string;
  backups: string[];
  aiTitle: string;
  ai: string[];
}

export const PRIVACY_MESSAGES: Record<Lang, PrivacyMessages> = {
  vi: {
    title: 'Quyền riêng tư',
    lead: 'OmniCourse lưu gì về bạn, lưu bao lâu, và cách xuất hoặc xóa dữ liệu. Căn cứ Luật 91/2025/QH15.',
    updated: (date) => `Cập nhật ngày ${date}.`,
    storedTitle: 'Chúng tôi lưu gì',
    storedIntro: 'Gắn với tài khoản của bạn, OmniCourse lưu:',
    stored: [
      'Tài khoản: email, tên hiển thị, mật khẩu (chỉ ở dạng băm một chiều, không ai đọc lại được), thời điểm bạn đồng ý cho xử lý dữ liệu, và ngày bạn yêu cầu xóa tài khoản nếu có.',
      'Câu trả lời khi bắt đầu: chương trình, khóa, học kỳ dự định tốt nghiệp, số tín chỉ mỗi học kỳ, học kỳ thực tập.',
      'Bảng điểm: các dòng bạn lưu (mã môn, tên môn, tín chỉ, kết quả, điểm, học kỳ).',
      'Lộ trình: tên lộ trình và các môn bạn xếp vào từng học kỳ.',
      'Phiên đăng nhập: trình duyệt và hệ điều hành của mỗi thiết bị, giờ đăng nhập và giờ hết hạn.',
      'Số lần dùng AI: mỗi lần gọi AI ghi tính năng, mô hình, số token, thời gian và kết quả thành công hay không. Không bao giờ ghi nội dung bạn hỏi hay câu trả lời.',
      'Quyền quản trị chương trình học, nếu bạn được cấp.',
    ],
    noPortalPassword: 'OmniCourse không bao giờ hỏi hay lưu mật khẩu cổng thông tin của trường.',
    keptTitle: 'Lưu bao lâu',
    kept: 'Đến khi bạn xóa tài khoản.',
    controlTitle: 'Xuất hoặc xóa dữ liệu',
    exportHow: (p) => `Xuất: vào ${p.settings} → ${p.section} → ${p.button}. Bạn nhận một file JSON gồm mọi thứ ở trên, không có mật khẩu hay mã phiên.`,
    deleteHow: (p) => `Xóa: vào ${p.settings} → ${p.section} → ${p.button}, rồi nhập mật khẩu để xác nhận. Mọi thiết bị bị đăng xuất ngay.`,
    deleteGrace: `Sau ${DELETION_GRACE_DAYS} ngày, tài khoản và mọi dữ liệu ở trên bị xóa vĩnh viễn. Đăng nhập lại trước hạn đó sẽ hủy việc xóa.`,
    backupsTitle: 'Bản sao lưu',
    backups: [
      `Trước mỗi lần cập nhật OmniCourse, máy chủ lưu một bản sao cơ sở dữ liệu để có thể quay lại nếu cập nhật lỗi. Chỉ giữ ${DEPLOY_COPIES_KEPT} bản gần nhất, nên dữ liệu của tài khoản đã xóa có thể còn trong các bản này cho tới khi thêm ${DEPLOY_COPIES_KEPT} lần cập nhật nữa.`,
      'Sao lưu hằng đêm, giữ 7 ngày, dự kiến bắt đầu cuối tháng 11/2026. Hiện chưa chạy.',
    ],
    aiTitle: 'AI',
    ai: [
      'Hiện chưa có tính năng AI nào được bật. Không dữ liệu nào của bạn được gửi cho mô hình AI.',
      'Khi có trợ lý AI hỏi đáp, trợ lý sẽ xin bạn đồng ý trước lần dùng đầu tiên. Trợ lý gửi câu bạn hỏi, và từ hồ sơ của bạn chỉ gửi chương trình, khóa, mã môn, điểm và học kỳ. Không bao giờ gửi tên, email hay mã số sinh viên.',
      'Khi bạn có thể tả mục tiêu lộ trình bằng lời của mình, chỉ câu bạn gõ và danh sách môn của chương trình học được gửi đi.',
      'AI được gọi qua OpenRouter. Tài khoản OpenRouter của OmniCourse được cài để không dùng nhà cung cấp nào lấy câu hỏi để huấn luyện mô hình.',
    ],
  },
  en: {
    title: 'Privacy notice',
    lead: 'What OmniCourse keeps about you, for how long, and how to export or delete it. Under Law 91/2025/QH15.',
    updated: (date) => `Last updated ${date}.`,
    storedTitle: 'What we store',
    storedIntro: 'Tied to your account, OmniCourse stores:',
    stored: [
      'Your account: email, display name, your password (only as a one-way hash nobody can read back), when you agreed to the processing of your data, and when you asked to delete the account, if you did.',
      'Your onboarding answers: program, cohort, target graduation term, credits per term, internship term.',
      'Your transcript: the rows you save (course code, name, credits, result, grade, term).',
      'Your plans: each plan’s name and the courses you place in each term.',
      'Your sessions: the browser and operating system of each device, when it signed in and when the session expires.',
      'AI usage counts: for each AI call, the feature, the model, the number of tokens, how long it took and whether it worked. Never what you asked or what the AI answered.',
      'Curriculum administration rights, if you are given any.',
    ],
    noPortalPassword: 'OmniCourse never asks for or stores your school portal password.',
    keptTitle: 'How long we keep it',
    kept: 'Until you delete your account.',
    controlTitle: 'Export or delete your data',
    exportHow: (p) => `Export: go to ${p.settings} → ${p.section} → ${p.button}. You get one JSON file with everything above, without passwords or session keys.`,
    deleteHow: (p) => `Delete: go to ${p.settings} → ${p.section} → ${p.button}, then enter your password to confirm. Every device is signed out at once.`,
    deleteGrace: `After ${DELETION_GRACE_DAYS} days, the account and everything above are deleted for good. Signing in again before then cancels the deletion.`,
    backupsTitle: 'Backups',
    backups: [
      `Before each update of OmniCourse, the server saves a copy of the database so a failed update can be undone. Only the ${DEPLOY_COPIES_KEPT} latest copies are kept, so data from a deleted account can stay in them until ${DEPLOY_COPIES_KEPT} more updates have run.`,
      'Nightly backups, kept for 7 days, are planned from late November 2026. They are not running yet.',
    ],
    aiTitle: 'AI',
    ai: [
      'No AI feature is switched on yet. None of your data is sent to an AI model.',
      'When the AI advisor chat arrives, it will ask for your consent before its first use. It will send your questions and, from your record, only your program, cohort, course codes, grades and terms. Never your name, email or student ID.',
      'When you can describe a planning goal in your own words, only that sentence and your curriculum’s course list will be sent.',
      'AI is reached through OpenRouter. OmniCourse’s OpenRouter account is set not to use any provider that trains its models on prompts.',
    ],
  },
};
