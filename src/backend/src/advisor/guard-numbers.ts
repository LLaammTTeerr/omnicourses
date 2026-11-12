import { stripMarks } from './retrieval/text.js';

// Numbers for the output guard (ADR 0015): numbers written out in words, and the rule a number
// belongs to. Deterministic; the same functions read an answer and a clause.

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

type Role = { kind: 'digit'; value: number; loose: boolean } | { kind: 'ten' } | { kind: 'tens'; loose: boolean } | { kind: 'hundred' };

function viRole(w: string): Role | undefined {
  if (w in VI_DIGITS) return { kind: 'digit', value: VI_DIGITS[w], loose: false };
  if (w === 'mười') return { kind: 'ten' };
  if (w === 'mươi') return { kind: 'tens', loose: false };
  if (w === 'muoi') return { kind: 'tens', loose: true };
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
  for (; j < ws.length; j++) {
    const role = viRole(ws[j].w);
    if (!role) {
      if (ZERO_WORDS.includes(ws[j].w) && (previous === 'hundred' || previous === 'tens')) continue; // "một trăm linh năm"
      break;
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
  const value = total + current;
  if (compound && length >= 2) return { value, length };
  // A lone word: written with diacritics, a unit after it, and not "một".
  if (length === 1 && previous === 'digit' && !(viRole(words[0].w) as { loose: boolean }).loose && words[0].w !== 'một' && VI_UNIT.test(after(j))) return { value, length };
  if (length === 1 && previous === 'ten' && VI_UNIT.test(after(j))) return { value, length };
  return undefined;
}

/** English number words from `i` on ("thirty", "twenty-eight", "one hundred and twenty"). */
function readEnglish(ws: { w: string }[], i: number, after: (j: number) => string): { value: number; length: number } | undefined {
  let total = 0;
  let current = 0;
  let j = i;
  let previous: 'unit' | 'tens' | 'hundred' | undefined;
  for (; j < ws.length; j++) {
    const w = ws[j].w;
    if (w === 'a' && previous === undefined && ws[j + 1]?.w === 'hundred') {
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
  // A lone word ("two programmes", "ten of them") only before a unit; a compound ("twenty-eight") always.
  if (length === 1 && !EN_UNIT.test(after(j))) return undefined;
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
  const text = lowered.replace(DECIMAL, (m) => {
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

// ── The rule a number belongs to ──────────────────────────────────────────────
// A number counts as grounded only where the cited clause states it for the same rule: "25" of the
// main-term cap does not ground "25 credits in a summer term", and "37" of the double-programme cap
// does not ground "every student may take 37". Each side of a number has a few qualifiers, read from
// its own phrase first, then its sentence (in a clause: its line, then the clause's heading). They
// must not conflict, and an answer must not widen a rule (a qualifier the source has and the answer
// drops: two programmes; "every student" for a rule of one programme) or adjust it ("plus 12 extra").

export interface Qualifiers {
  term: Set<string>;
  programme: Set<string>;
  bound: Set<string>;
  double: boolean;
  delta: boolean;
  universal: boolean;
}

const SETS: Record<'term' | 'programme' | 'bound', Record<string, string>> = {
  term: {
    summer: 'hè|summer|kỳ he|ky he|hoc ky he',
    main: 'học kỳ chính|kỳ chính|hoc ky chinh|ky chinh|main terms?|main semesters?|regular terms?|regular semesters?',
  },
  programme: {
    special: 'tiên tiến|liên kết|chất lượng cao|tien tien|lien ket|chat luong cao|advanced|joint|high-quality|high quality|apcs|clc',
    standard: 'đại trà|dai tra|standard programmes?|standard programs?|standard',
  },
  bound: {
    max: 'tối đa|toi da|maximum|max|at most|up to|cap|caps|không vượt quá|khong vuot qua|not exceed|no more than|upper limit',
    min: 'tối thiểu|toi thieu|minimum|min|at least|no fewer than|no less than|lower limit',
  },
};
const DOUBLE = 'hai chương trình|hai chuong trinh|cùng lúc hai|cung luc hai|two programmes|two programs|double|second major|second degree|song ngành|song nganh|hai ngành|hai nganh';
const DELTA = 'plus|extra|additional|thêm|cộng|bonus|on top';
const UNIVERSAL = 'every student|all students|any student|every programme|every program|any programme|any program|everyone|mọi sinh viên|tất cả sinh viên|bất kỳ sinh viên|moi sinh vien|tat ca sinh vien';

export function qualifiersOf(text: string): Qualifiers {
  const pick = (kind: keyof typeof SETS) => new Set(Object.entries(SETS[kind]).filter(([, alt]) => has(text, alt)).map(([k]) => k));
  return { term: pick('term'), programme: pick('programme'), bound: pick('bound'), double: has(text, DOUBLE), delta: has(text, DELTA), universal: has(text, UNIVERSAL) };
}

/** Qualifiers of the nearest level that states each one: a phrase, then its wider context. */
export function nearest(levels: Qualifiers[]): Qualifiers {
  const first = (k: 'term' | 'programme' | 'bound') => levels.find((l) => l[k].size > 0)?.[k] ?? new Set<string>();
  return {
    term: first('term'),
    programme: first('programme'),
    bound: first('bound'),
    double: levels.some((l) => l.double),
    delta: levels[0]?.delta ?? false,
    universal: levels.some((l) => l.universal),
  };
}

const conflict = (a: Set<string>, b: Set<string>): boolean => a.size > 0 && b.size > 0 && ![...a].some((x) => b.has(x));

/** Whether an answer's number may rest on a clause's same number. */
export function sameRule(answer: Qualifiers, source: Qualifiers): boolean {
  if (conflict(answer.term, source.term) || conflict(answer.programme, source.programme) || conflict(answer.bound, source.bound)) return false;
  if (source.double !== answer.double) return false;
  if (answer.delta && !source.delta) return false;
  if (answer.universal && (source.programme.size > 0 || source.double)) return false;
  return true;
}

/** Phrases of a line: split at a comma, semicolon or colon followed by a space (not "5,0"), or a dash between spaces. */
export function phrases(line: string): { text: string; at: number }[] {
  const out: { text: string; at: number }[] = [];
  let start = 0;
  for (const m of line.matchAll(/[,;:](?=\s|$)|\s[-–—]\s/g)) {
    out.push({ text: line.slice(start, m.index), at: start });
    start = m.index + m[0].length;
  }
  out.push({ text: line.slice(start), at: start });
  return out;
}

/** Folds lower-case text without changing its length, so an index in one is an index in the other. */
export function foldSameLength(lowered: string): string {
  return lowered.replace(/[^\x00-\x7f]/gu, (ch) => {
    const folded = stripMarks(ch);
    return folded.length === ch.length ? folded : ' '.repeat(ch.length);
  });
}

/** Every number of a text with its index: "5,0" and "5.0" are 5. */
export function numbersAt(text: string): { value: number; at: number }[] {
  return [...text.matchAll(/(?<![\d.,])\d+(?:[.,]\d+)?/g)].map((m) => ({ value: Number(m[0].replace(',', '.')), at: m.index }));
}

/** The qualifiers of the number at `at` in a clause text (lower case, numbers as digits). */
export function sourceQualifiers(text: string, at: number): Qualifiers {
  const lines = text.split('\n');
  let offset = 0;
  for (const line of lines) {
    if (at <= offset + line.length) {
      const inLine = at - offset;
      const phrase = phrases(line).filter((p) => p.at <= inLine).at(-1)!;
      return nearest([qualifiersOf(phrase.text), qualifiersOf(line), qualifiersOf(lines[0])]);
    }
    offset += line.length + 1;
  }
  return nearest([qualifiersOf(text)]);
}
