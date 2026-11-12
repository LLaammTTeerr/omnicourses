// Redaction of what a student types before it reaches the AI provider (ADR 0015, AGENTS.md hard rule
// 3). A student may paste a portal password, a student ID, an email address, a phone number or a date
// of birth; none of them helps answer a study-rule question, and none may leave the server. Each is
// replaced by a placeholder; the reply then tells the student not to share them (REDACTION_NOTICE).
// Deterministic and dependency-free; nothing here is logged, not even a count.

export const PLACEHOLDERS = {
  password: '[password removed]',
  studentId: '[student ID removed]',
  email: '[email removed]',
  phone: '[phone removed]',
  dateOfBirth: '[date of birth removed]',
} as const;

const L = '\\p{L}';
const word = (alternatives: string): string => `(?<!${L})(?:${alternatives})(?!${L})`;

// A password after a cue: "mật khẩu cổng của mình là Synth3tic!Pass", "password: …", "my portal
// password 'Synth3tic!Pass'". A strong cue (password, mật khẩu, OTP) takes any secret-looking word
// after "is/là/:"; a weak one ("mk", "pin", "pwd" — "mk" is also teen code for "mình") only a word
// with a digit or a symbol. Up to four words may stand between the cue and "is" ("cổng của mình").
const STRONG_CUE = 'mật khẩu|mat khau|mật mã|mat ma|password|passwd|passcode|otp|mã otp|ma otp';
const WEAK_CUE = 'mk|pwd|pw|pin|mã pin|ma pin';
const FILLER = `(?:\\s+(?!(?:là|la|is|was)(?!${L}))[^\\s:="'“”‘’]+){0,4}?`;
const SEPARATOR = `\\s*(?:(?:là|la|is|was)(?!${L})|[:=])\\s*`;
const QUOTED = `["'“‘]([^"'”’\\n]{1,64})["'”’]`;
const BARE = `([^\\s"'“”‘’]{1,64})`;
// A bare word needs "is", "là", ":" or "=" before it; a quoted one may follow the cue directly.
const STRONG_PASSWORD = new RegExp(`${word(STRONG_CUE)}${FILLER}(?:${SEPARATOR}(?:${QUOTED}|${BARE})|\\s+${QUOTED})`, 'giu');
const WEAK_PASSWORD = new RegExp(`${word(WEAK_CUE)}(?:${SEPARATOR}(?:${QUOTED}|${BARE})|\\s+${QUOTED})`, 'giu');
/** Words after a cue that are no secret: "mật khẩu là gì?", "my password is wrong". */
const NOT_A_SECRET = new RegExp(`^(?:gì|gi|what|bao|nhiêu|nhieu|sai|wrong|đúng|dung|correct|the|my|your|of|for|to|a|an|để|de|của|cua|cổng|cong|portal|account|tài|khoản|mới|new|old|cũ|cu)$`, 'iu');

// A student ID (MSSV, 8 to 10 digits), and any digit run after an ID cue; emails; Vietnamese phone
// numbers (0 or +84, then 9 or 10 digits, spaces or dots allowed); a date after a birth-date cue.
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;
const PHONE = /(?<![\d.,])(?:\+?84|0)(?:[\s.-]?\d){9,10}(?![\d]|[.,]\d)/g;
const ID_CUE = new RegExp(`(${word('mssv|mã số sinh viên|ma so sinh vien|mã sinh viên|ma sinh vien|student id|student number|student no')}\\s*(?:(?:của|cua)\\s+\\S+\\s*)?(?:(?:là|la|is)(?!${L})|[:#=])?\\s*)(\\d{5,12})`, 'giu');
const STUDENT_ID = /(?<![\d.,/-])\d{8,10}(?![\d]|[.,]\d)/g;
const DOB = new RegExp(`(${word('ngày sinh|ngay sinh|sinh ngày|sinh ngay|date of birth|dob|birthday|born on')}\\s*(?:(?:là|la|is|on)(?!${L})|:)?\\s*)(\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2})`, 'giu');

const isSecret = (candidate: string, strong: boolean): boolean => {
  const token = candidate.replace(/[.,;:!?)\]]+$/u, '');
  if (!token || NOT_A_SECRET.test(token)) return false;
  return strong ? token.length >= 4 || /[\d\W]/u.test(token) : /[\d\p{P}\p{S}]/u.test(token) && token.length >= 4;
};

function redactPasswords(text: string, pattern: RegExp, strong: boolean): string {
  return text.replace(pattern, (match: string, quoted?: string, bare?: string, quotedAfterSpace?: string) => {
    const q = quoted ?? quotedAfterSpace;
    const secret = q ?? (bare !== undefined && isSecret(bare, strong) ? bare.replace(/[.,;:!?)\]]+$/u, '') : undefined);
    if (secret === undefined) return match;
    const at = match.lastIndexOf(secret);
    return `${match.slice(0, at)}${PLACEHOLDERS.password}${match.slice(at + secret.length)}`;
  });
}

/** The text with secrets and identifiers replaced by placeholders, and whether anything was replaced. */
export function redactPersonalData(text: string): { text: string; redacted: boolean } {
  let out = redactPasswords(text, STRONG_PASSWORD, true);
  out = redactPasswords(out, WEAK_PASSWORD, false);
  out = out
    .replace(EMAIL, PLACEHOLDERS.email)
    .replace(DOB, (_m, cue: string) => `${cue}${PLACEHOLDERS.dateOfBirth}`)
    .replace(ID_CUE, (_m, cue: string) => `${cue}${PLACEHOLDERS.studentId}`)
    .replace(PHONE, PLACEHOLDERS.phone)
    .replace(STUDENT_ID, PLACEHOLDERS.studentId);
  return { text: out, redacted: out !== text };
}
