import type { Lang } from '../locale.js';
import { PASSWORD_MIN_LENGTH } from './api.js';
import type { Strength } from './password-strength.js';

interface AuthMessages {
  email: string;
  password: string;
  noPortalPassword: string;
  emailInvalid: string;
  rateLimited: string;
  unreachable: string;
  signInTitle: string;
  signInLead: string;
  signIn: string;
  signingIn: string;
  wrongCredentials: string;
  passwordRequired: string;
  noAccount: string;
  createAccount: string;
  signInArtChip: string;
  signInArt: string;
  signInArtText: string;
  signUpTitle: string;
  signUpLead: string;
  displayName: string;
  displayNameHint: string;
  displayNameRequired: string;
  displayNameTooLong: string;
  passwordPlaceholder: string;
  passwordHint: string;
  passwordShort: (missing: number) => string;
  passwordTooLong: string;
  strength: Record<Exclude<Strength, 'short'>, string>;
  strengthLabel: string;
  consent: string;
  consentDetail: string;
  consentRequired: string;
  privacyLink: string;
  signUp: string;
  signingUp: string;
  emailTaken: string;
  signInInstead: string;
  checkFields: string;
  haveAccount: string;
  signUpArtChip: string;
  signUpArt: string;
  signUpArtText: string;
}

export const AUTH_MESSAGES: Record<Lang, AuthMessages> = {
  vi: {
    email: 'Email',
    password: 'Mật khẩu',
    noPortalPassword: 'OmniCourse không bao giờ hỏi mật khẩu cổng thông tin của trường.',
    emailInvalid: 'Email chưa đúng định dạng.',
    rateLimited: 'Quá nhiều lần thử từ mạng này. Đợi một phút rồi thử lại.',
    unreachable: 'Chưa kết nối được OmniCourse. Kiểm tra mạng rồi thử lại sau ít phút.',
    signInTitle: 'Chào mừng trở lại.',
    signInLead: 'Đăng nhập để xem bảng điểm và cài đặt của bạn.',
    signIn: 'Đăng nhập',
    signingIn: 'Đang đăng nhập…',
    wrongCredentials: 'Email hoặc mật khẩu không đúng.',
    passwordRequired: 'Nhập mật khẩu.',
    noAccount: 'Chưa có tài khoản?',
    createAccount: 'Tạo tài khoản',
    signInArtChip: 'Mẹo',
    signInArt: 'Duyệt từng dòng bảng điểm trước khi lưu.',
    signInArtText: 'Dòng nào thiếu thông tin sẽ được đánh dấu, và không lưu được cho tới khi sửa xong.',
    signUpTitle: 'Tạo tài khoản.',
    signUpLead: 'Miễn phí. Mất khoảng một phút.',
    displayName: 'Tên hiển thị',
    displayNameHint: 'Không cần tên thật. Không bao giờ gửi cho AI.',
    displayNameRequired: 'Nhập tên hiển thị.',
    displayNameTooLong: 'Tên hiển thị tối đa 100 ký tự.',
    passwordPlaceholder: `Ít nhất ${PASSWORD_MIN_LENGTH} ký tự`,
    passwordHint: 'Dùng một mật khẩu riêng, khác mật khẩu cổng trường.',
    passwordShort: (missing) => `Còn thiếu ${missing} ký tự.`,
    passwordTooLong: 'Mật khẩu tối đa 128 ký tự.',
    strength: { weak: 'Yếu', fair: 'Tạm được', strong: 'Mạnh', 'very-strong': 'Rất mạnh' },
    strengthLabel: 'Độ mạnh mật khẩu',
    consent: 'Tôi đồng ý cho OmniCourse xử lý dữ liệu học tập của tôi',
    consentDetail: 'Bảng điểm và những gì bạn nhập. Lưu đến khi bạn xóa tài khoản. Xuất hoặc xóa bất cứ lúc nào. Căn cứ Luật 91/2025/QH15.',
    consentRequired: 'Cần đồng ý xử lý dữ liệu để tạo tài khoản.',
    privacyLink: 'Đọc thông báo quyền riêng tư',
    signUp: 'Tạo tài khoản',
    signingUp: 'Đang tạo tài khoản…',
    emailTaken: 'Email này đã có tài khoản.',
    signInInstead: 'Đăng nhập',
    checkFields: 'Có ô chưa hợp lệ. Kiểm tra lại rồi gửi lần nữa.',
    haveAccount: 'Đã có tài khoản?',
    signUpArtChip: '8 nhóm tín chỉ',
    signUpArt: 'Mỗi nhóm tín chỉ một màu và một ký hiệu.',
    signUpArtText: 'Màu giúp nhìn nhanh, ký hiệu giữ nghĩa khi không phân biệt được màu.',
  },
  en: {
    email: 'Email',
    password: 'Password',
    noPortalPassword: "OmniCourse never asks for your school portal password.",
    emailInvalid: 'Enter a valid email address.',
    rateLimited: 'Too many attempts from this network. Wait a minute, then try again.',
    unreachable: 'Could not reach OmniCourse. Check your connection and try again in a moment.',
    signInTitle: 'Welcome back.',
    signInLead: 'Sign in to see your transcript and settings.',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    wrongCredentials: 'Wrong email or password.',
    passwordRequired: 'Enter your password.',
    noAccount: 'No account yet?',
    createAccount: 'Create account',
    signInArtChip: 'Tip',
    signInArt: 'Review every transcript row before you save.',
    signInArtText: 'A row with missing details is marked, and cannot be saved until you fix it.',
    signUpTitle: 'Create your account.',
    signUpLead: 'Free. It takes about a minute.',
    displayName: 'Display name',
    displayNameHint: 'It need not be your real name. Never sent to an AI.',
    displayNameRequired: 'Enter a display name.',
    displayNameTooLong: 'A display name has at most 100 characters.',
    passwordPlaceholder: `At least ${PASSWORD_MIN_LENGTH} characters`,
    passwordHint: 'Use a password of its own, not your school portal password.',
    passwordShort: (missing) => `${missing} more character${missing === 1 ? '' : 's'} needed.`,
    passwordTooLong: 'A password has at most 128 characters.',
    strength: { weak: 'Weak', fair: 'Fair', strong: 'Strong', 'very-strong': 'Very strong' },
    strengthLabel: 'Password strength',
    consent: 'I agree that OmniCourse processes my study data',
    consentDetail: 'Your transcript and what you enter. Kept until you delete your account. Export or delete it at any time. Under Law 91/2025/QH15.',
    consentRequired: 'You need to agree to the processing of your data to create an account.',
    privacyLink: 'Read the privacy notice',
    signUp: 'Create account',
    signingUp: 'Creating your account…',
    emailTaken: 'This email already has an account.',
    signInInstead: 'Sign in',
    checkFields: 'Some fields are not valid. Check them and send again.',
    haveAccount: 'Already have an account?',
    signUpArtChip: '8 credit groups',
    signUpArt: 'Each credit group has its own colour and glyph.',
    signUpArtText: 'The colour is quick to read; the glyph keeps the meaning when colours look alike.',
  },
};
