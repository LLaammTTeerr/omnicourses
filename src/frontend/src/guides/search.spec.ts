import { describe, expect, it } from 'vitest';
import type { GuideListItem, GuideListText } from '../guides-api.js';
import { fold, matches } from './search.js';

type Words = { title: string; keywords: string[] };
const text = (words: Words): GuideListText => ({
  ...words,
  portal: { name: 'Portal', url: 'https://example.com', account: 'Account' },
  version: 1,
  lastCheckedOn: '2026-11-01',
  outOfDate: false,
});
const item = (id: string, vi: Words | null, en: Words | null): GuideListItem => ({
  id,
  group: 'registration',
  texts: { ...(vi ? { vi: text(vi) } : {}), ...(en ? { en: text(en) } : {}) },
});

// Synthetic entries shaped like the B1 batch, so the GUIDE-01c queries have something to find.
const GUIDES = [
  item('accounts-and-portals', { title: 'Tài khoản và cổng thông tin', keywords: ['email', 'moodle'] }, { title: 'Your school accounts and portals', keywords: ['account'] }),
  item('register-courses', { title: 'Đăng ký học phần', keywords: ['dkhp'] }, { title: 'Register for courses', keywords: ['registration'] }),
  item('pay-tuition', { title: 'Đóng học phí', keywords: ['tiền học'] }, { title: 'Pay tuition', keywords: ['fees'] }),
  item('grades-and-transcript', { title: 'Xem điểm, tải bảng điểm', keywords: ['pdf'] }, { title: 'View your grades and download your transcript PDF', keywords: ['transcript'] }),
];
const found = (query: string) => GUIDES.filter((g) => matches(g, query)).map((g) => g.id);

describe('fold', () => {
  it('removes Vietnamese diacritics and turns đ into d', () => {
    expect(fold('Đăng ký học phần')).toBe('dang ky hoc phan');
    expect(fold('đóng HỌC PHÍ')).toBe('dong hoc phi');
  });

  it('folds decomposed Unicode like composed', () => {
    expect(fold('học phí'.normalize('NFD'))).toBe(fold('học phí'.normalize('NFC')));
  });

  it('trims and collapses spaces', () => {
    expect(fold('  hoc \t  phi  ')).toBe('hoc phi');
  });
});

describe('matches (GUIDE-01c)', () => {
  it.each([
    ['học phí', ['pay-tuition']],
    ['hoc phi', ['pay-tuition']],
    ['HỌC PHÍ', ['pay-tuition']],
    ['  hoc   phi  ', ['pay-tuition']],
    ['học phí'.normalize('NFD'), ['pay-tuition']],
    ['hoc ph', ['register-courses', 'pay-tuition']],
    ['tuition', ['pay-tuition']],
    ['đăng ký học phần', ['register-courses']],
    ['dang ky hoc phan', ['register-courses']],
    ['ĐĂNG KÝ', ['register-courses']],
    ['dkhp', ['register-courses']],
    ['register', ['register-courses']],
    ['bảng điểm', ['grades-and-transcript']],
    ['bang diem', ['grades-and-transcript']],
    ['transcript', ['grades-and-transcript']],
    ['tài khoản', ['accounts-and-portals']],
    ['tai khoan', ['accounts-and-portals']],
  ])('%j finds %j', (query, expected) => {
    expect(found(query)).toEqual(expected);
  });

  it.each(['%', '_', "'", '\\', 'a'.repeat(500), 'xyzzy'])('%j finds nothing', (query) => {
    expect(found(query)).toEqual([]);
  });

  it('finds every guide for an empty query', () => {
    expect(found('')).toHaveLength(4);
    expect(found('   ')).toHaveLength(4);
  });

  it('finds a guide written in one language only, from either screen language', () => {
    expect(matches(item('zz-vi-only', { title: 'Hướng dẫn thử zz-vi-only', keywords: ['zz-vi-only'] }, null), 'zz-vi-only')).toBe(true);
  });
});
