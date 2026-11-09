import type { Lang } from '../locale.js';

interface SettingsMessages {
  title: string;
  sections: string;
  profile: string;
  study: string;
  security: string;
  look: string;
  data: string;
  displayName: string;
  displayNameNote: string;
  email: string;
  language: string;
  languageNote: string;
  sessions: string;
  sessionsNote: string;
  device: string;
  signedInAt: string;
  expiresAt: string;
  unknownDevice: string;
  thisDevice: string;
  revoke: string;
  revokeLabel: (device: string) => string;
  revokeTitle: string;
  revokeBody: (device: string) => string;
  revoked: string;
  revokeFailed: string;
  sessionsFailed: string;
  retry: string;
  loading: string;
  cancel: string;
  theme: string;
  themeNote: string;
  light: string;
  dark: string;
  groups: string;
  groupsNote: string;
  exportTitle: string;
  exportNote: string;
  export: string;
  exporting: string;
  exported: (file: string) => string;
  exportFailed: string;
  deleteTitle: string;
  deleteNote: string;
  delete: string;
  deleteDialogTitle: string;
  deleteDialogBody: string;
  deletePassword: string;
  deleting: string;
  keep: string;
  wrongPassword: string;
  rateLimited: string;
  unreachable: string;
  deleted: (date: string) => string;
  signOut: string;
  signedOut: string;
}

export const SETTINGS_MESSAGES: Record<Lang, SettingsMessages> = {
  vi: {
    title: 'Cài đặt',
    sections: 'Mục cài đặt',
    profile: 'Hồ sơ',
    study: 'Chương trình và mục tiêu',
    security: 'Phiên đăng nhập',
    look: 'Giao diện',
    data: 'Dữ liệu của bạn',
    displayName: 'Tên hiển thị',
    displayNameNote: 'Không cần tên thật. Không bao giờ gửi cho AI.',
    email: 'Email',
    language: 'Ngôn ngữ',
    languageNote: 'Tiếng Việt hoặc English.',
    sessions: 'Các thiết bị đang đăng nhập',
    sessionsNote: 'Mỗi phiên hết hạn sau 7 ngày không dùng. Thu hồi một phiên để đăng xuất thiết bị đó ngay.',
    device: 'Thiết bị',
    signedInAt: 'Đăng nhập lúc',
    expiresAt: 'Hết hạn',
    unknownDevice: 'Thiết bị không rõ',
    thisDevice: 'Thiết bị này',
    revoke: 'Thu hồi',
    revokeLabel: (device) => `Thu hồi phiên ${device}`,
    revokeTitle: 'Thu hồi phiên này?',
    revokeBody: (device) => `${device} bị đăng xuất ngay và phải đăng nhập lại.`,
    revoked: 'Đã thu hồi phiên.',
    revokeFailed: 'Chưa thu hồi được phiên. Thử lại sau ít phút.',
    sessionsFailed: 'Chưa tải được danh sách phiên.',
    retry: 'Thử lại',
    loading: 'Đang tải…',
    cancel: 'Hủy',
    theme: 'Chủ đề',
    themeNote: 'Sáng hoặc tối, nhớ trên trình duyệt này.',
    light: 'Sáng',
    dark: 'Tối',
    groups: 'Màu theo nhóm tín chỉ',
    groupsNote: 'Mỗi nhóm có màu và ký hiệu riêng, để không phải dựa vào màu.',
    exportTitle: 'Xuất toàn bộ dữ liệu',
    exportNote: 'Một file JSON gồm tài khoản, bảng điểm và mọi thứ OmniCourse lưu về bạn. Không có mật khẩu.',
    export: 'Xuất dữ liệu',
    exporting: 'Đang chuẩn bị…',
    exported: (file) => `Đã tải về ${file}.`,
    exportFailed: 'Chưa xuất được dữ liệu. Thử lại sau ít phút.',
    deleteTitle: 'Xóa tài khoản',
    deleteNote: 'Đăng xuất mọi thiết bị ngay. Xóa vĩnh viễn sau 30 ngày.',
    delete: 'Xóa tài khoản',
    deleteDialogTitle: 'Xóa tài khoản?',
    deleteDialogBody:
      'Mọi phiên đăng nhập bị thu hồi ngay. Dữ liệu của bạn bị xóa vĩnh viễn sau 30 ngày. Đăng nhập lại trước hạn đó sẽ hủy việc xóa. Nên xuất dữ liệu trước nếu bạn muốn giữ một bản.',
    deletePassword: 'Nhập mật khẩu để xác nhận',
    deleting: 'Đang xóa…',
    keep: 'Giữ lại',
    wrongPassword: 'Mật khẩu không đúng.',
    rateLimited: 'Quá nhiều lần thử. Đợi một phút rồi thử lại.',
    unreachable: 'Chưa kết nối được OmniCourse. Thử lại sau ít phút.',
    deleted: (date) => `Tài khoản sẽ bị xóa vĩnh viễn sau ${date}. Đăng nhập lại trước đó để hủy.`,
    signOut: 'Đăng xuất',
    signedOut: 'Đã đăng xuất.',
  },
  en: {
    title: 'Settings',
    sections: 'Settings sections',
    profile: 'Profile',
    study: 'Program and goal',
    security: 'Sessions',
    look: 'Appearance',
    data: 'Your data',
    displayName: 'Display name',
    displayNameNote: 'It need not be your real name. Never sent to an AI.',
    email: 'Email',
    language: 'Language',
    languageNote: 'Vietnamese or English.',
    sessions: 'Devices signed in',
    sessionsNote: 'Each session expires after 7 days without use. Revoke one to sign that device out at once.',
    device: 'Device',
    signedInAt: 'Signed in',
    expiresAt: 'Expires',
    unknownDevice: 'Unknown device',
    thisDevice: 'This device',
    revoke: 'Revoke',
    revokeLabel: (device) => `Revoke the session on ${device}`,
    revokeTitle: 'Revoke this session?',
    revokeBody: (device) => `${device} is signed out at once and has to sign in again.`,
    revoked: 'Session revoked.',
    revokeFailed: 'Could not revoke the session. Try again in a moment.',
    sessionsFailed: 'Could not load your sessions.',
    retry: 'Try again',
    loading: 'Loading…',
    cancel: 'Cancel',
    theme: 'Theme',
    themeNote: 'Light or dark, remembered in this browser.',
    light: 'Light',
    dark: 'Dark',
    groups: 'Colours by credit group',
    groupsNote: 'Each group has its own colour and glyph, so colour is never the only cue.',
    exportTitle: 'Export all your data',
    exportNote: 'One JSON file with your account, your transcript and everything OmniCourse holds about you. No passwords.',
    export: 'Export data',
    exporting: 'Preparing…',
    exported: (file) => `Downloaded ${file}.`,
    exportFailed: 'Could not export your data. Try again in a moment.',
    deleteTitle: 'Delete account',
    deleteNote: 'Signs out every device at once. Deleted for good after 30 days.',
    delete: 'Delete account',
    deleteDialogTitle: 'Delete your account?',
    deleteDialogBody:
      'Every session is revoked at once. Your data is deleted for good after 30 days. Signing in again before then cancels the deletion. Export your data first if you want to keep a copy.',
    deletePassword: 'Enter your password to confirm',
    deleting: 'Deleting…',
    keep: 'Keep my account',
    wrongPassword: 'Wrong password.',
    rateLimited: 'Too many attempts. Wait a minute, then try again.',
    unreachable: 'Could not reach OmniCourse. Try again in a moment.',
    deleted: (date) => `Your account will be deleted for good after ${date}. Sign in before then to cancel.`,
    signOut: 'Sign out',
    signedOut: 'Signed out.',
  },
};
