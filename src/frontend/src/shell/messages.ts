import type { Lang } from '../locale.js';

export const SHELL_MESSAGES = {
  vi: {
    skip: 'Bỏ qua điều hướng',
    nav: 'Điều hướng chính',
    tabs: 'Điều hướng nhanh',
    account: 'Tài khoản',
    toDark: 'Giao diện tối',
    toLight: 'Giao diện sáng',
    collapse: 'Thu gọn',
    expand: 'Mở rộng',
    signIn: 'Đăng nhập',
    signUp: 'Tạo tài khoản',
    openApp: 'Vào OmniCourse',
    footer: 'OmniCourse · dự án môn Nhập môn Công nghệ phần mềm, APCS, HCMUS.',
    regulation: 'Quy chế đào tạo 2021',
    sessionEnded: 'Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.',
    restored: 'Chào mừng trở lại. Việc xóa tài khoản đã được hủy, dữ liệu của bạn vẫn còn nguyên.',
  },
  en: {
    skip: 'Skip to main content',
    nav: 'Main navigation',
    tabs: 'Quick navigation',
    account: 'Account',
    toDark: 'Dark theme',
    toLight: 'Light theme',
    collapse: 'Collapse',
    expand: 'Expand',
    signIn: 'Sign in',
    signUp: 'Create account',
    openApp: 'Open OmniCourse',
    footer: 'OmniCourse · a software engineering course project, APCS, HCMUS.',
    regulation: 'Training regulation 2021',
    sessionEnded: 'Your session has ended. Please sign in again.',
    restored: 'Welcome back. Your account deletion is cancelled and your data is intact.',
  },
} satisfies Record<Lang, Record<string, string>>;

/** The school's training regulation (QĐ 1175/QĐ-KHTN), as the prototypes link it. */
export const REGULATION_URL = 'https://www.ctda.hcmus.edu.vn/wp-content/uploads/2023/03/Quy-che-dao-tao-2021.pdf';
