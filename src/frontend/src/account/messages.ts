import type { Lang } from '../locale.js';
import { CLASS_NAME_MAX_LENGTH, DELETION_GRACE_DAYS } from './api.js';

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
  userId: string;
  userIdNote: string;
  copy: string;
  userIdCopied: string;
  userIdNotCopied: string;
  studentId: string;
  studentIdNote: string;
  studentIdInvalid: string;
  className: string;
  classNameNote: string;
  classNameTooLong: string;
  saveProfile: string;
  savingProfile: string;
  profileSaved: string;
  profileSaveFailed: string;
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
  noAnswer: string;
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
    userId: 'Mã người dùng',
    userIdNote: 'Gửi mã này cho người quản lý phân quyền khi bạn cần quyền quản trị. Đây là mã định danh, không phải mật khẩu.',
    copy: 'Sao chép',
    userIdCopied: 'Đã sao chép mã người dùng.',
    userIdNotCopied: 'Chưa sao chép được. Mã đã được chọn sẵn: bấm Ctrl+C để sao chép.',
    studentId: 'Mã số sinh viên (MSSV)',
    studentIdNote: 'Không bắt buộc. Gồm 8 chữ số. Chỉ bạn thấy, và không bao giờ gửi cho AI.',
    studentIdInvalid: 'MSSV gồm đúng 8 chữ số, ví dụ 24120000.',
    className: 'Lớp',
    classNameNote: 'Không bắt buộc, ví dụ 24CTT0. Chỉ bạn thấy, và không bao giờ gửi cho AI.',
    classNameTooLong: `Tên lớp dài tối đa ${CLASS_NAME_MAX_LENGTH} ký tự.`,
    saveProfile: 'Lưu',
    savingProfile: 'Đang lưu…',
    profileSaved: 'Đã lưu MSSV và lớp.',
    profileSaveFailed: 'Chưa lưu được. Thử lại sau ít phút.',
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
    deleteNote: `Đăng xuất mọi thiết bị ngay. Xóa vĩnh viễn sau ${DELETION_GRACE_DAYS} ngày.`,
    delete: 'Xóa tài khoản',
    deleteDialogTitle: 'Xóa tài khoản?',
    deleteDialogBody:
      `Mọi phiên đăng nhập bị thu hồi ngay. Dữ liệu của bạn bị xóa vĩnh viễn sau ${DELETION_GRACE_DAYS} ngày. Đăng nhập lại trước hạn đó sẽ hủy việc xóa. Nên xuất dữ liệu trước nếu bạn muốn giữ một bản.`,
    deletePassword: 'Nhập mật khẩu để xác nhận',
    deleting: 'Đang xóa…',
    keep: 'Giữ lại',
    wrongPassword: 'Mật khẩu không đúng.',
    rateLimited: 'Quá nhiều lần thử. Đợi một phút rồi thử lại.',
    unreachable: 'Chưa kết nối được OmniCourse. Thử lại sau ít phút.',
    noAnswer:
      'OmniCourse chưa trả lời, có thể việc xóa đã xong. Nếu thử lại mà bị đăng xuất thì tài khoản đã được hẹn xóa, và đăng nhập lại sẽ hủy việc xóa.',
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
    userId: 'User ID',
    userIdNote: 'Give this ID to an access manager when you need an administration permission. It identifies your account; it is not a password.',
    copy: 'Copy',
    userIdCopied: 'User ID copied.',
    userIdNotCopied: 'Could not copy. The ID is selected: press Ctrl+C to copy it.',
    studentId: 'Student ID (MSSV)',
    studentIdNote: 'Optional. 8 digits. Only you see it, and it is never sent to an AI.',
    studentIdInvalid: 'A student ID is exactly 8 digits, for example 24120000.',
    className: 'Class',
    classNameNote: 'Optional, for example 24CTT0. Only you see it, and it is never sent to an AI.',
    classNameTooLong: `A class name is at most ${CLASS_NAME_MAX_LENGTH} characters.`,
    saveProfile: 'Save',
    savingProfile: 'Saving…',
    profileSaved: 'Student ID and class saved.',
    profileSaveFailed: 'Could not save. Try again in a moment.',
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
    deleteNote: `Signs out every device at once. Deleted for good after ${DELETION_GRACE_DAYS} days.`,
    delete: 'Delete account',
    deleteDialogTitle: 'Delete your account?',
    deleteDialogBody:
      `Every session is revoked at once. Your data is deleted for good after ${DELETION_GRACE_DAYS} days. Signing in again before then cancels the deletion. Export your data first if you want to keep a copy.`,
    deletePassword: 'Enter your password to confirm',
    deleting: 'Deleting…',
    keep: 'Keep my account',
    wrongPassword: 'Wrong password.',
    rateLimited: 'Too many attempts. Wait a minute, then try again.',
    unreachable: 'Could not reach OmniCourse. Try again in a moment.',
    noAnswer: 'OmniCourse did not answer, so the deletion may have gone through. If trying again signs you out, it did, and signing in again cancels it.',
    deleted: (date) => `Your account will be deleted for good after ${date}. Sign in before then to cancel.`,
    signOut: 'Sign out',
    signedOut: 'Signed out.',
  },
};
