// The number reader (ADR 0015): numbers written out in words, Roman numerals and CJK numerals, as
// digits. Deterministic. The explanation guard rejects any number it finds (option A: every number
// the student sees comes from a passage or an engine fact, never from the model's words).

/** `(?<!letter)(a|b)(?!letter)`: \b knows only ASCII letters, and Vietnamese has many more. */
const word = (alternatives: string): string => `(?<!\\p{L})(?:${alternatives})(?!\\p{L})`;
const has = (text: string, alternatives: string): boolean => new RegExp(word(alternatives), 'u').test(text);

// ── Numbers in words ──────────────────────────────────────────────────────────
// "thirty credits", "hai mươi tám tín chỉ", "ba tín chỉ", "năm phẩy không" are numbers too. Folded
// Vietnamese collides (sau: after/six, nam: year/five, tu: from/four), so single words are read only
// with diacritics and before a unit ("ba tín chỉ"); words without diacritics only inside a compound
// with mươi or trăm ("ba muoi"). A lone "one" or "một" ("one of the conditions") is not read.

const EN_UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const EN_TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const VI_DIGITS: Record<string, number> = { một: 1, mốt: 1, hai: 2, ba: 3, bốn: 4, tư: 4, năm: 5, lăm: 5, sáu: 6, bảy: 7, bẩy: 7, tám: 8, chín: 9 };
const VI_FOLDED_DIGITS: Record<string, number> = { mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, lam: 5, sau: 6, bay: 7, tam: 8, chin: 9 };
const ZERO_WORDS = ['không', 'khong', 'zero', 'linh', 'lẻ', 'le'];
/** Words after an English number that make a lone number word a number: "thirty credits" (not "two programmes"). */
const EN_UNIT = /^\s*(credits?|points?|terms?|semesters?|years?|months?|weeks?|days?|courses?|subjects?|modules?|times|hours?|periods?|percent|%|out of)(?!\p{L})/u;
/** Words after a Vietnamese number that make a lone digit word a number: "ba tín chỉ", "bốn năm". */
const VI_UNIT = /^\s*(tín chỉ|tín|tc|điểm|học kỳ|kỳ|năm|tháng|tuần|ngày|môn|học phần|lần|giờ|tiết|phần trăm|%)(?!\p{L})/u;

/** A credit, term or course unit up to four words after a lone English number word, in the same sentence. */
const NEAR_EN_UNIT = /^(?:[\s-]+[\p{L}'’]+){0,3}?[\s-]+(?:credits?|terms?|semesters?|courses?|subjects?|modules?|classes)(?!\p{L})/u;

// "no credits", "không cần tín chỉ nào": zero, said without a number word.
const NO_UNIT_EN = /(?<!\p{L})no(?=\s+(?:credits?|courses?|subjects?|modules?|terms?|semesters?|classes)(?!\p{L}))/gu;
const NO_UNIT_VI = /(?<!\p{L})(?:không|khong)(?=(?:\s+\p{L}+){0,3}?\s+(?:tín chỉ|tin chi|học phần|hoc phan|môn|mon|học kỳ|hoc ky|kỳ|ky)\s+(?:nào|nao)(?!\p{L}))/gu;

// CJK numerals ("三十" is 30): read wherever they are.
const CJK_DIGITS: Record<string, number> = { 〇: 0, 零: 0, 一: 1, 二: 2, 两: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const CJK_NUMBER = /[〇零一二两兩三四五六七八九十百千]+/gu;
function cjkValue(text: string): number {
  let total = 0;
  let digit = 0;
  for (const ch of text) {
    if (ch in CJK_DIGITS) digit = digit * 10 + CJK_DIGITS[ch];
    else {
      const unit = ch === '十' ? 10 : ch === '百' ? 100 : 1000;
      total += (digit || 1) * unit;
      digit = 0;
    }
  }
  return total + digit;
}

// Roman numerals before a unit ("XXV credits"); in capitals, so "I" and "mix" are words.
const ROMAN = /(?<![\p{L}\p{N}])(?=[IVXLC])(C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})(?![\p{L}\p{N}])/gu;
const ROMAN_VALUES: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
function romanValue(numeral: string): number {
  let value = 0;
  for (let k = 0; k < numeral.length; k++) {
    const v = ROMAN_VALUES[numeral[k]];
    value += v < (ROMAN_VALUES[numeral[k + 1]] ?? 0) ? -v : v;
  }
  return value;
}

/** Text as written, with Roman numerals before a unit as digits: "XXV credits" → "25 credits". Reads case, so it runs before lower-casing. */
export function withRomanNumerals(text: string): string {
  return text.replace(ROMAN, (m: string, _c: string, _x: string, _i: string, at: number) => {
    if (!m || m === 'I' || m === 'C' || m === 'L') return m;
    const after = text.slice(at + m.length);
    return EN_UNIT.test(after) || VI_UNIT.test(after.toLowerCase()) ? String(romanValue(m)) : m;
  });
}

type Role = { kind: 'digit'; value: number; loose: boolean } | { kind: 'ten' } | { kind: 'tens'; loose: boolean } | { kind: 'hundred' };

function viRole(w: string): Role | undefined {
  if (w in VI_DIGITS) return { kind: 'digit', value: VI_DIGITS[w], loose: false };
  if (w === 'mười') return { kind: 'ten' };
  if (w === 'mươi') return { kind: 'tens', loose: false };
  if (w === 'muoi') return { kind: 'tens', loose: true };
  if (w === 'chục') return { kind: 'tens', loose: false }; // "ba chục" is 30, "chục tín chỉ" 10
  if (w === 'chuc') return { kind: 'tens', loose: true };
  if (w === 'trăm' || w === 'tram') return { kind: 'hundred' };
  if (w in VI_FOLDED_DIGITS) return { kind: 'digit', value: VI_FOLDED_DIGITS[w], loose: true };
  return undefined;
}

/** Vietnamese number words from `i` on: the value and how many words, or undefined. */
function readVietnamese(ws: { w: string }[], i: number, after: (j: number) => string): { value: number; length: number } | undefined {
  let total = 0;
  let current = 0;
  let j = i;
  let compound = false;
  let previous: Role['kind'] | undefined;
  let half = false;
  for (; j < ws.length; j++) {
    const role = viRole(ws[j].w);
    if (!role) {
      if (ZERO_WORDS.includes(ws[j].w) && (previous === 'hundred' || previous === 'tens')) continue; // "một trăm linh năm"
      // "sáu rưỡi" is 6.5, "ba mươi rưỡi" 30.5
      if (ws[j].w === 'rưỡi' && previous !== undefined && previous !== 'hundred') {
        half = true;
        j++;
      }
      break;
    }
    if (role.kind === 'tens' && previous === undefined && ws[j].w === 'chục') {
      current = 10;
      compound = true;
      previous = 'ten';
      continue;
    }
    if (role.kind === 'digit') {
      if (previous === 'digit') break; // "bốn năm": four, then "năm" (years)
      if (previous === undefined && ws[j].w === 'mốt') break;
      current += role.value;
    } else if (role.kind === 'ten') {
      if (previous === 'digit' || previous === 'ten') break;
      current += 10;
      compound = true;
    } else if (role.kind === 'tens') {
      if (previous !== 'digit') break;
      current *= 10;
      compound = true;
    } else {
      total += (current || 1) * 100;
      current = 0;
      compound = true;
    }
    previous = role.kind;
  }
  const length = j - i;
  if (length === 0) return undefined;
  const words = ws.slice(i, j);
  const value = total + current + (half ? 0.5 : 0);
  if ((compound || half) && length >= 2) return { value, length };
  // A lone word: written with diacritics, a unit after it, and not "một".
  if (length === 1 && previous === 'digit' && !(viRole(words[0].w) as { loose: boolean }).loose && words[0].w !== 'một' && VI_UNIT.test(after(j))) return { value, length };
  if (length === 1 && previous === 'ten' && (VI_UNIT.test(after(j)) || words[0].w === 'chục')) return { value, length };
  return undefined;
}

/** English number words from `i` on ("thirty", "twenty-eight", "one hundred and twenty"). */
function readEnglish(ws: { w: string }[], i: number, after: (j: number) => string): { value: number; length: number } | undefined {
  // "negative one", "minus two": a negative number, which no clause states.
  if ((ws[i].w === 'negative' || ws[i].w === 'minus') && i + 1 < ws.length) {
    const rest = readEnglish(ws, i + 1, after) ?? (ws[i + 1].w === 'one' ? { value: 1, length: 1 } : undefined);
    return rest && { value: -rest.value, length: rest.length + 1 };
  }
  let total = 0;
  let current = 0;
  let j = i;
  let previous: 'unit' | 'tens' | 'hundred' | 'dozen' | undefined;
  for (; j < ws.length; j++) {
    const w = ws[j].w;
    if (w === 'dozen') {
      // "two dozen" is 24, "a dozen" 12
      if (previous !== 'unit') break;
      current *= 12;
      previous = 'dozen';
    } else if (w === 'a' && previous === undefined && ws[j + 1]?.w === 'dozen') {
      current = 1;
      previous = 'unit';
    } else if (previous === 'dozen') {
      break;
    } else if (w === 'a' && previous === undefined && ws[j + 1]?.w === 'hundred') {
      current = 1;
      previous = 'unit';
    } else if (w === 'and' && previous === 'hundred' && (ws[j + 1]?.w in EN_UNITS || ws[j + 1]?.w in EN_TENS)) {
      continue;
    } else if (w in EN_TENS) {
      if (previous === 'unit' || previous === 'tens') break;
      current += EN_TENS[w];
      previous = 'tens';
    } else if (w in EN_UNITS) {
      if (previous === 'unit' || (previous === 'tens' && EN_UNITS[w] >= 10)) break;
      current += EN_UNITS[w];
      previous = 'unit';
    } else if (w === 'hundred') {
      if (previous === 'hundred') break;
      total += (current || 1) * 100;
      current = 0;
      previous = 'hundred';
    } else break;
  }
  const length = j - i;
  if (length === 0 || (length === 1 && (ws[i].w === 'one' || ws[i].w === 'a'))) return undefined;
  // A lone word ("two programmes", "ten of them") only before a unit, or a few words before a
  // credit, term or course ("seven across your graded courses"); a compound ("twenty-eight") always.
  if (length === 1 && !EN_UNIT.test(after(j)) && !NEAR_EN_UNIT.test(after(j))) return undefined;
  return { value: total + current, length };
}

const DECIMAL_DIGIT: Record<string, string> = {
  ...Object.fromEntries(Object.entries(VI_DIGITS).map(([k, v]) => [k, String(v)])),
  ...Object.fromEntries(Object.entries(VI_FOLDED_DIGITS).map(([k, v]) => [k, String(v)])),
  ...Object.fromEntries(Object.entries(EN_UNITS).filter(([, v]) => v < 10).map(([k, v]) => [k, String(v)])),
  không: '0', khong: '0', mười: '10', muoi: '10', ten: '10',
};
const DECIMAL = new RegExp(`${word(Object.keys(DECIMAL_DIGIT).join('|'))}\\s+(?:phẩy|phay|chấm|cham|point)\\s+${word(Object.keys(DECIMAL_DIGIT).join('|'))}`, 'gu');

/** Lower-case text with numbers in words written as digits: "ba mươi tín chỉ" → "30 tín chỉ". */
export function withSpelledNumbers(lowered: string): string {
  const text = lowered
    .replace(CJK_NUMBER, (m) => String(cjkValue(m)))
    .replace(NO_UNIT_EN, '0')
    .replace(NO_UNIT_VI, '0')
    .replace(DECIMAL, (m) => {
    const [a, , b] = m.split(/\s+/);
    return `${DECIMAL_DIGIT[a]}.${DECIMAL_DIGIT[b]}`;
  });
  const ws = [...text.matchAll(/\p{L}+/gu)].map((m) => ({ w: m[0], at: m.index, end: m.index + m[0].length }));
  // Neighbours only: words split by a space or a hyphen ("twenty-eight").
  const runs: { w: string; at: number; end: number }[][] = [];
  for (const w of ws) {
    const last = runs.at(-1)?.at(-1);
    if (last && /^[\s-]+$/.test(text.slice(last.end, w.at))) runs.at(-1)!.push(w);
    else runs.push([w]);
  }
  const out: { at: number; end: number; value: number }[] = [];
  for (const run of runs) {
    for (let i = 0; i < run.length; ) {
      const after = (j: number) => text.slice(run[j - 1].end);
      const found = readEnglish(run, i, after) ?? readVietnamese(run, i, after);
      if (!found) {
        i++;
        continue;
      }
      out.push({ at: run[i].at, end: run[i + found.length - 1].end, value: found.value });
      i += found.length;
    }
  }
  let result = text;
  for (const n of out.reverse()) result = `${result.slice(0, n.at)}${n.value}${result.slice(n.end)}`;
  return result;
}
