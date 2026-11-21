import { describe, expect, it } from 'vitest';
import { fold, matchesEveryWord } from './text-search.js';

describe('fold and matchesEveryWord', () => {
  it('drops diacritics and case, đ included', () => {
    expect(fold('Học Máy ĐẠI CƯƠNG')).toBe('hoc may dai cuong');
  });

  it('folds composed and decomposed text alike, and spacing to single spaces', () => {
    expect(fold('  học   phí '.normalize('NFD'))).toBe('hoc phi');
  });

  it('finds a course by code or name, typed without diacritics, word by word', () => {
    expect(matchesEveryWord('hoc may', 'ZZ414', 'Học máy')).toBe(true);
    expect(matchesEveryWord('may hoc', 'ZZ414', 'Học máy')).toBe(true);
    expect(matchesEveryWord('zz41', 'ZZ414', 'Học máy')).toBe(true);
    expect(matchesEveryWord('machine', 'ZZ414', 'Học máy', 'Machine learning')).toBe(true);
    expect(matchesEveryWord('hoc mat', 'ZZ414', 'Học máy')).toBe(false);
    expect(matchesEveryWord('  ', 'ZZ414', null)).toBe(true);
  });
});
