import { describe, expect, it } from 'vitest';
import { eventTitle, otherEventTitle, spanIn } from './present.js';

const both = { title: 'Đăng ký học phần', titleEn: 'Course registration' };
const viOnly = { title: 'Nghỉ Tết', titleEn: null };

describe('calendar event presentation', () => {
  it('shows the English title in English and the Vietnamese one otherwise', () => {
    expect(eventTitle(both, 'en')).toBe('Course registration');
    expect(eventTitle(both, 'vi')).toBe('Đăng ký học phần');
  });

  it('falls back to the Vietnamese title when there is no English one', () => {
    expect(eventTitle(viOnly, 'en')).toBe('Nghỉ Tết');
    expect(eventTitle({ ...viOnly, titleEn: '' }, 'en')).toBe('Nghỉ Tết');
  });

  it('offers the title in the other language only when both exist', () => {
    expect(otherEventTitle(both, 'en')).toBe('Đăng ký học phần');
    expect(otherEventTitle(both, 'vi')).toBe('Course registration');
    expect(otherEventTitle(viOnly, 'en')).toBeNull();
    expect(otherEventTitle(viOnly, 'vi')).toBeNull();
  });

  it('formats a one-day date once and a range with both ends', () => {
    const format = (iso: string) => `<${iso}>`;
    expect(spanIn({ startsOn: '2026-07-20', endsOn: '2026-07-20' }, format)).toBe('<2026-07-20>');
    expect(spanIn({ startsOn: '2026-07-20', endsOn: '2026-07-31' }, format)).toBe('<2026-07-20> – <2026-07-31>');
  });
});
