import { formatDate, formatSpan, type Lang } from '../locale.js';
import type { NotificationEvent, NotificationKind, NotificationLink } from './api.js';

interface NotificationMessages {
  title: string;
  subtitle: (unread: number) => string;
  kinds: Record<NotificationKind, string>;
  transcriptDetail: string;
  links: Record<NotificationLink, string>;
  unread: string;
  markRead: string;
  markReadOf: (title: string) => string;
  markAllRead: string;
  allRead: string;
  markFailed: string;
  older: string;
  olderFailed: string;
  empty: string;
  emptyText: string;
  loading: string;
  loadFailed: string;
  retry: string;
  bell: (unread: number) => string;
  badge: (unread: number) => string;
}

export const eventLine = (event: NotificationEvent, lang: Lang) => `${lang === 'en' ? (event.titleEn ?? event.title) : event.title} · ${formatSpan(event.startsOn, event.endsOn, (iso) => formatDate(iso, lang))}`;

export const NOTIFICATION_MESSAGES: Record<Lang, NotificationMessages> = {
  vi: {
    title: 'Thông báo',
    subtitle: (n) => (n === 0 ? 'Bạn đã đọc hết thông báo.' : `${n} thông báo chưa đọc.`),
    kinds: {
      registration_soon: 'Sắp mở đăng ký học phần',
      registration_open: 'Hôm nay mở đăng ký học phần',
      term_start: 'Hôm nay bắt đầu học kỳ',
      transcript_changed: 'Bảng điểm đã thay đổi',
    },
    transcriptDetail: 'Bảng điểm bạn vừa lưu khác bản trước. Xem lại kết quả xét tốt nghiệp.',
    links: { calendar: 'Xem lịch', planner: 'Mở lộ trình', audit: 'Xem xét tốt nghiệp' },
    unread: 'Chưa đọc',
    markRead: 'Đánh dấu đã đọc',
    markReadOf: (title) => `Đánh dấu đã đọc: ${title}`,
    markAllRead: 'Đánh dấu đã đọc hết',
    allRead: 'Đã đánh dấu đã đọc hết.',
    markFailed: 'Không đánh dấu được. Hãy thử lại.',
    older: 'Xem thông báo cũ hơn',
    olderFailed: 'Không tải được thông báo cũ hơn.',
    empty: 'Chưa có thông báo',
    emptyText: 'Nhắc đăng ký học phần, ngày đầu học kỳ và thay đổi bảng điểm sẽ hiện ở đây. Chuông ở thanh bên báo khi có thông báo mới.',
    loading: 'Đang tải thông báo…',
    loadFailed: 'Không tải được thông báo.',
    retry: 'Thử lại',
    bell: (n) => (n === 0 ? 'Thông báo' : `Thông báo, ${n} chưa đọc`),
    badge: (n) => `${n} chưa đọc`,
  },
  en: {
    title: 'Notifications',
    subtitle: (n) => (n === 0 ? 'You have read every notification.' : `${n} unread ${n === 1 ? 'notification' : 'notifications'}.`),
    kinds: {
      registration_soon: 'Course registration opens soon',
      registration_open: 'Course registration opens today',
      term_start: 'The term starts today',
      transcript_changed: 'Your transcript changed',
    },
    transcriptDetail: 'The transcript you saved differs from the one before. Check your degree audit again.',
    links: { calendar: 'Open the calendar', planner: 'Open your plans', audit: 'Open the degree audit' },
    unread: 'Unread',
    markRead: 'Mark as read',
    markReadOf: (title) => `Mark as read: ${title}`,
    markAllRead: 'Mark all as read',
    allRead: 'Every notification is marked as read.',
    markFailed: 'Could not mark it as read. Try again.',
    older: 'Show older notifications',
    olderFailed: 'Older notifications could not be loaded.',
    empty: 'No notifications yet',
    emptyText: 'Registration reminders, the first day of a term and changes to your transcript show here. The bell in the sidebar tells you when one arrives.',
    loading: 'Loading notifications…',
    loadFailed: 'Notifications could not be loaded.',
    retry: 'Try again',
    bell: (n) => (n === 0 ? 'Notifications' : `Notifications, ${n} unread`),
    badge: (n) => `${n} unread`,
  },
};
