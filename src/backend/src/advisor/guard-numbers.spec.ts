import { describe, expect, it } from 'vitest';
import { nearest, qualifiersOf, sameRule, withRomanNumerals, withSpelledNumbers } from './guard-numbers.js';
import { cleanInput } from './retrieval/text.js';

describe('numbers in words (ADR 0015)', () => {
  it.each([
    ['up to thirty credits', 'up to 30 credits'],
    ['twenty-eight credits', '28 credits'],
    ['one hundred and twenty credits', '120 credits'],
    ['ba mươi tín chỉ', '30 tín chỉ'],
    ['hai mươi tám tín chỉ', '28 tín chỉ'],
    ['mười hai tín chỉ', '12 tín chỉ'],
    ['một trăm hai mươi tín chỉ', '120 tín chỉ'],
    ['ba muoi tin chi', '30 tin chi'],
    ['ba tín chỉ', '3 tín chỉ'],
    ['bốn năm', '4 năm'],
    ['năm phẩy không', '5.0'],
    ['five point zero', '5.0'],
    // rt77 round 2
    ['tối đa 三十 tín chỉ', 'tối đa 30 tín chỉ'],
    ['up to two dozen credits', 'up to 24 credits'],
    ['a dozen credits', '12 credits'],
    ['tối đa ba chục tín chỉ', 'tối đa 30 tín chỉ'],
    ['khoảng sáu rưỡi trên các môn', 'khoảng 6.5 trên các môn'],
    ['negative one credits', '-1 credits'],
    ['minus two terms', '-2 terms'],
    ['zero credits', '0 credits'],
    ['above seven across your graded courses', 'above 7 across your graded courses'],
    ['needs no credits at all', 'needs 0 credits at all'],
    ['không cần đăng ký tín chỉ nào', '0 cần đăng ký tín chỉ nào'],
  ])('reads "%s"', (text, expected) => {
    expect(withSpelledNumbers(text)).toBe(expected);
  });

  it.each([
    'sau học kỳ hè', // after the summer term
    'năm học 2024-2025',
    'one of the conditions',
    'students in two programmes',
    'trong một học kỳ',
    'nam sinh viên',
    'there is no clause about parking',
    'two programmes at once may register',
    'không có điều khoản nào',
  ])('leaves "%s"', (text) => {
    expect(withSpelledNumbers(text)).toBe(text);
  });

  it('reads Roman numerals before a unit, in capitals only', () => {
    expect(withRomanNumerals('Summer-term maximum: XXV credits')).toBe('Summer-term maximum: 25 credits');
    expect(withRomanNumerals('tối đa XII tín chỉ')).toBe('tối đa 12 tín chỉ');
    for (const text of ['Can I take 25 credits?', 'học kỳ II', 'mix credits', 'Part IV of the handbook', 'I credits']) expect(withRomanNumerals(text)).toBe(text);
  });

  it('reads digits of every script as ASCII', () => {
    expect(cleanInput('٣٠ credits, ३० credits, ３０ credits')).toBe('30 credits, 30 credits, 30 credits');
  });
});

describe('the rule a number belongs to (ADR 0015)', () => {
  const q = (text: string) => nearest([qualifiersOf(text)]);
  it('keeps a main-term number off a summer rule, and a double-programme number off everyone', () => {
    expect(sameRule(q('tối đa 25 tín chỉ trong học kỳ hè'), q('học kỳ chính: tối đa là 25 tín chỉ'))).toBe(false);
    expect(sameRule(q('every student may take 37 credits'), q('sinh viên học cùng lúc hai chương trình, tối đa 37'))).toBe(false);
    expect(sameRule(q('plus 12 extra credits'), q('học kỳ hè là 12 tín chỉ'))).toBe(false);
    expect(sameRule(q('at most 12 credits in a summer term'), q('tối đa trong học kỳ hè là 12 tín chỉ'))).toBe(true);
    expect(sameRule(q('the cap is 22 credits'), q('chương trình tiên tiến: tối đa là 22 tín chỉ'))).toBe(true);
    expect(sameRule(q('the minimum is 10'), q('tối đa là 10'))).toBe(false);
  });
});
