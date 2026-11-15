import { foldKeepingLength } from './retrieval/text.js';

// Redaction of what a student types before it reaches the AI provider (ADR 0016, AGENTS.md hard rule
// 3). A student may paste a portal password, a verification code, a student ID, a national ID
// number, an email address, a phone number, a home address or a date of birth; none of them helps
// answer a study-rule question, and none may leave the server. Each is replaced by a placeholder; the
// reply then tells the student not to share them (REDACTION_NOTICE).
//
// The patterns run on the text folded to the same length (no diacritics, lower case, lookalike
// letters as Latin), so a cue matches however it is typed: "Mật khẩu", "mat khau", "mậtkhẩu" (a
// zero-width space removed), "раssword" (Cyrillic р, а). What they find is cut from the text itself.
// Deterministic and dependency-free; nothing here is logged, not even a count.
//
// Digits spelled out in words are read only right after an ID cue, as a run of 8 or more ("MSSV hai
// một một hai bảy không không một"): alone, the Vietnamese digit words are common words (năm, sáu, tư).
// Not read (ADR 0016 residual R13): spelled-out digits with no ID cue (a phone number read out), compound
// number words ("hai mươi mốt", "twenty-one"), fewer than 8 digit words beside typed groups, an ID
// split across messages, a name.

export const PLACEHOLDERS = {
  password: '[password removed]',
  code: '[verification code removed]',
  studentId: '[student ID removed]',
  nationalId: '[ID number removed]',
  email: '[email removed]',
  phone: '[phone removed]',
  address: '[address removed]',
  dateOfBirth: '[date of birth removed]',
} as const;
type Kind = keyof typeof PLACEHOLDERS;

const L = '\\p{L}';
/** Alternatives as whole words; a space inside a cue matches any spacing or none ("mat khau", "matkhau"). */
const cue = (alternatives: string): string => `(?<![\\p{L}\\p{N}])(?:${alternatives.replace(/ /g, '\\s*')})(?![\\p{L}])`;

// ── Cues (folded) ──────────────────────────────────────────────────────────────
// A strong cue takes any secret-looking word after "is/là/:"; a weak one ("mk" is also teen code for
// "mình") only a word with a digit or a symbol.
const STRONG_CUE = 'mat khau|mat ma|password|passwd|passcode|pass word|secret|credentials?';
const WEAK_CUE = 'mk|pwd|pw|pass|pin|ma pin';
const CODE_CUE = 'otp|ma otp|ma xac thuc|ma xac nhan|ma bao mat|verification code|one time code|one-time code|security code|auth code|authentication code|2fa code';
/** Cues near which a token shaped like a password is one: "login/pw: synthuser / Synth3tic!Pass". */
const LOGIN_CUE = `${STRONG_CUE}|${WEAK_CUE}|login|log in|sign in|dang nhap|username|user|tai khoan|account`;
const ID_CUE = 'mssv|msv|ma so sinh vien|ma sinh vien|ma so sv|ma sv|sv|student id|student number|student no';
const NATIONAL_ID_CUE =
  'cccd|cmnd|cmt|can cuoc|can cuoc cong dan|chung minh nhan dan|chung minh thu|so dinh danh|ma dinh danh|citizen id|national id|id card|identity card|identity number|id number|passport|ho chieu';
const DOB_CUE = 'ngay sinh|sinh ngay|sinh nam|sinh vao|date of birth|dob|birthday|birth date|born';
const ADDRESS_CUE =
  'dia chi|nha (?:minh|toi|em|tui|tao) (?:o|tai)|(?:minh|toi|em|tui) (?:dang )?(?:song|o|tro) (?:o |tai )?|i live (?:at|in|on)|i stay at|live at|my (?:home )?address(?: is)?|home address(?: is)?|address(?: is)?';

// ── Shapes ─────────────────────────────────────────────────────────────────────
/** Up to `n` words between a cue and "is/là/:" ("cổng thông tin đào tạo của mình hiện tại"); not across a sentence end. */
const filler = (n: number) => `(?:[\\s,]+(?!(?:la|is|was|are|=)(?!${L}))[^\\s:="'“”‘’.!?;]+){0,${n}}?`;
const SEPARATOR = `\\s*(?:(?:la|is|was|are)(?!${L})|[:=])\\s*`;
/** After an ID cue a dash or # also separates: "SV-21127001", "MSSV #21127001". */
const ID_SEPARATOR = `\\s*(?:(?:la|is|was|are)(?!${L})|[:=#-])\\s*`;
const QUOTED = `["'“‘]([^"'”’\\n]{1,64})["'”’]`;
const BARE = `([^\\s"'“”‘’]{1,64})`;
/** Digits typed with single spaces, dots or dashes between them: "2 1 1 2 7 0 0 1", "21-12-70-01", "0792 0400 1234". */
const DIGITS = (min: number, max: number) => `(\\d(?:[\\s.\\-/]?\\d){${min - 1},${max - 1}})(?![\\d]|[.,]\\d)`;
/**
 * A run of 8 to 20 digits spelled out in Vietnamese or English words, folded ("hai mot mot hai bay
 * khong khong mot", "two-one-one-two-seven-oh-oh-one"); a typed digit may stand among them.
 */
const DIGIT_WORD = '(?:khong|linh|le|mot|hai|ba|bon|tu|nam|lam|sau|bay|tam|chin|zero|oh|o|one|two|three|four|five|six|seven|eight|nine|\\d)(?![\\p{L}\\p{N}])';
const SPELLED_DIGITS = `(${DIGIT_WORD}(?:[\\s,-]+${DIGIT_WORD}){7,19})`;
const MONTH = 'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';
const DATE =
  `\\d{1,2}\\s*[/.-]\\s*\\d{1,2}\\s*[/.-]\\s*\\d{2,4}|\\d{4}\\s*[/.-]\\s*\\d{1,2}\\s*[/.-]\\s*\\d{1,2}` +
  `|\\d{1,2}\\s+thang\\s+\\d{1,2}(?:\\s*(?:,|nam)\\s*\\d{4})?|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTH})\\.?,?\\s+\\d{4}` +
  `|(?:${MONTH})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}|(?:19|20)\\d{2}`;

const LOCAL = '(?<![\\p{L}\\p{N}._%+-])[\\p{L}\\p{N}._%+-]+';
const LABEL = '[\\p{L}\\p{N}-]+';
const DOT_WORD = '(?:\\s*[\\[({<]\\s*(?:dot|cham|\\.)\\s*[\\])}>]\\s*|\\s+(?:dot|cham)\\s+)';
const DOT = `(?:${DOT_WORD}|\\.)`;

const g = (source: string) => new RegExp(source, 'giud');

interface Rule {
  kind: Kind;
  pattern: RegExp;
  /** Whether a match is a secret; for a password, the captured word must look like one. */
  accept?: (secret: string) => boolean;
}

/** Words after a cue that are no secret: "mật khẩu là gì?", "my password is wrong". */
const NOT_A_SECRET = /^(?:gi|what|bao|nhieu|sai|wrong|dung|correct|the|my|your|of|for|to|a|an|de|cua|cong|portal|account|tai|khoan|moi|new|old|cu|bi|khoa|locked|expired|het|han|forgotten|quen)$/u;
const trimEnd = (s: string) => s.replace(/[.,;:!?)\]}]+$/u, '');
const strongSecret = (s: string) => {
  const token = trimEnd(s);
  return !!token && !NOT_A_SECRET.test(foldKeepingLength(token)) && (token.length >= 4 || /[\d\W]/u.test(token));
};
const weakSecret = (s: string) => {
  const token = trimEnd(s);
  return /[\d\p{P}\p{S}]/u.test(token) && token.length >= 4;
};
/** A token shaped like a password: letters, digits and a symbol ("Synth3tic!Pass", "abc@1234"), not a course code or a citation. */
const PASSWORD_SHAPE = (token: string) => /\p{L}/u.test(token) && /\d/.test(token) && /[!@#$%^&*_+=?~-]/.test(token) && token.length >= 6 && !/[[\]/]/.test(token);

// In priority order: a span taken by an earlier rule is not taken again.
const RULES: Rule[] = [
  { kind: 'code', pattern: g(`${cue(CODE_CUE)}${filler(6)}(?:${SEPARATOR}(?:${QUOTED}|${BARE})|\\s+${QUOTED}|\\s+(\\d{4,8})(?!\\d))`), accept: strongSecret },
  { kind: 'password', pattern: g(`${cue(STRONG_CUE)}${filler(10)}(?:${SEPARATOR}(?:${QUOTED}|${BARE})|\\s+${QUOTED})`), accept: strongSecret },
  { kind: 'password', pattern: g(`${cue(WEAK_CUE)}${filler(3)}(?:${SEPARATOR}(?:${QUOTED}|${BARE})|\\s+${QUOTED})`), accept: weakSecret },
  { kind: 'email', pattern: g(`(${LOCAL}\\s*[\\[({<]\\s*at\\s*[\\])}>]\\s*${LABEL}(?:${DOT}${LABEL})+)`) },
  { kind: 'email', pattern: g(`(${LOCAL}\\s+at\\s+${LABEL}(?:${DOT}${LABEL})*${DOT_WORD}${LABEL}(?:${DOT}${LABEL})*)`) },
  { kind: 'email', pattern: g(`(${LOCAL}\\s*@\\s*${LABEL}(?:\\.${LABEL})+)`) },
  { kind: 'dateOfBirth', pattern: g(`${cue(DOB_CUE)}(?:\\s+(?:la|is|on|in|vao|ngay|nam|:)(?!${L}))?\\s*:?\\s*(${DATE})(?![\\d])`) },
  { kind: 'nationalId', pattern: g(`${cue(NATIONAL_ID_CUE)}${filler(4)}(?:${ID_SEPARATOR})?\\s*${DIGITS(9, 12)}`) },
  { kind: 'studentId', pattern: g(`${cue(ID_CUE)}\\s*(?:(?:cua)\\s+\\S+\\s*)?(?:${ID_SEPARATOR})?\\s*${DIGITS(5, 12)}`) },
  { kind: 'nationalId', pattern: g(`${cue(NATIONAL_ID_CUE)}${filler(4)}(?:${ID_SEPARATOR})?\\s*${SPELLED_DIGITS}`) },
  { kind: 'studentId', pattern: g(`${cue(ID_CUE)}${filler(4)}(?:${ID_SEPARATOR})?\\s*${SPELLED_DIGITS}`) },
  { kind: 'phone', pattern: g(`(?<![\\d.,])((?:\\(\\s*\\+?84\\s*\\)|\\+?84|0)(?:[\\s./-]?\\d){9,10})(?![\\d]|[.,]\\d)`) },
  { kind: 'nationalId', pattern: g(`(?<![\\d.,/-])(\\d{12})(?![\\d]|[.,]\\d)`) },
  { kind: 'studentId', pattern: g(`(?<![\\d.,/-])(\\d{8,10})(?![\\d]|[.,]\\d)`) },
];

/**
 * A run of digit groups split by single spaces or dashes, 9 digits or more, none of them a year,
 * the groups all one digit or all longer: "0901 234 567", "2 1 1 2 7 0 0 1 9". Grades ("8.5 7.0")
 * have dots and are not read.
 */
const DIGIT_GROUPS = /(?<![\d.,/-])\d{1,4}(?:[ -]\d{1,4}){2,}(?![\d]|[.,]\d)/g;
const ADDRESS_START = g(cue(ADDRESS_CUE));
const ADDRESS_PART =
  /^\s*(?:\d+[a-z]?(?:\/\d+)*\s+\S|so\s+\d|(?:duong|pho|phuong|quan|huyen|xa|thi xa|thi tran|tinh|thanh pho|tp|hem|ngo|ngach|kiet|ap|khu pho|kp|chung cu|toa|street|st|road|rd|avenue|ave|lane|alley|ward|district|dist|city|province|village|block|apartment|apt)(?![\p{L}]))/u;

type Span = [start: number, end: number, kind: Kind];

/** The span of the secret in one match: its first non-empty capture group. */
function secretSpan(match: RegExpExecArray, accept?: (s: string) => boolean): [number, number] | undefined {
  for (let i = 1; i < match.length; i++) {
    if (match[i] === undefined || !match.indices?.[i]) continue;
    const [start, end] = match.indices[i]!;
    const secret = trimEnd(match[i]);
    if (accept && !accept(match[i])) return undefined;
    return [start, start + secret.length || end];
  }
  return undefined;
}

function spansOf(text: string, view: string): Span[] {
  const spans: Span[] = [];
  const free = (s: number, e: number) => e > s && spans.every(([a, b]) => e <= a || s >= b);
  const take = (s: number, e: number, kind: Kind) => free(s, e) && spans.push([s, e, kind]);

  for (const { kind, pattern, accept } of RULES) {
    for (const m of view.matchAll(pattern)) {
      const span = secretSpan(m as RegExpExecArray, accept);
      if (span) take(span[0], span[1], kind);
    }
  }
  // A token shaped like a password in the same sentence as a login cue, even with no "is" before it.
  for (const m of view.matchAll(g(cue(LOGIN_CUE)))) {
    const from = m.index + m[0].length;
    const stop = view.slice(from, from + 80).search(/[.!?\n](?:\s|$)/);
    const window = text.slice(from, stop < 0 ? from + 80 : from + stop);
    for (const t of window.matchAll(/[^\s"'“”‘’(){}<>,;]+/gu)) {
      const token = trimEnd(t[0]).replace(/^[[:=]+/u, '');
      if (PASSWORD_SHAPE(token)) {
        const at = from + t.index + t[0].indexOf(token);
        take(at, at + token.length, 'password');
      }
    }
  }
  // A home address after a cue: comma-separated parts while each looks like one ("12 Hẻm …, Phường 4, Quận 5").
  for (const m of view.matchAll(ADDRESS_START)) {
    let at = m.index + m[0].length;
    const sep = /^\s*(?:(?:la|is|:)(?!\p{L}))?\s*/u.exec(view.slice(at))!;
    at += sep[0].length;
    const start = at;
    let end = at;
    for (const part of view.slice(at).split(/(?=[,;.!?\n])/u)) {
      const body = part.replace(/^,/, '');
      if (/^[;.!?\n]/.test(part) || !ADDRESS_PART.test(body)) break;
      end = at + part.length;
      at = end;
    }
    while (end > start && /\s/.test(view[end - 1])) end--;
    take(start, end, 'address');
  }
  // Spaced digit groups of 9 digits or more, whatever comes before them.
  for (const m of view.matchAll(DIGIT_GROUPS)) {
    const groups = m[0].split(/[ -]/);
    const digits = groups.join('');
    const mixed = groups.some((d) => d.length === 1) && groups.some((d) => d.length > 1);
    if (digits.length < 9 || mixed || groups.some((d) => /^(?:19|20)\d\d$/.test(d))) continue;
    const kind: Kind = digits.length === 12 ? 'nationalId' : /^(?:0|84)/.test(digits) && digits.length >= 10 ? 'phone' : 'studentId';
    take(m.index, m.index + m[0].length, kind);
  }
  return spans.sort((a, b) => a[0] - b[0]);
}

/** The text with secrets and identifiers replaced by placeholders, and whether anything was replaced. */
export function redactPersonalData(text: string): { text: string; redacted: boolean } {
  const view = foldKeepingLength(text);
  const spans = spansOf(text, view);
  let out = text;
  for (const [start, end, kind] of [...spans].reverse()) out = `${out.slice(0, start)}${PLACEHOLDERS[kind]}${out.slice(end)}`;
  return { text: out, redacted: spans.length > 0 };
}
