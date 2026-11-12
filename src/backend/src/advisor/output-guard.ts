import { domainToUnicode } from 'node:url';
import { type AdvisorLanguage, FIXED_REPLIES } from './advisor-prompt.js';
import type { TurnEvidence } from './advisor-tools.js';
import { abolishedRule, namedStandingClaim, type StandingClaim, standingClaims } from './guard-claims.js';
import { foldSameLength, nearest, numbersAt, phrases, qualifiersOf, sameRule, sourceQualifiers, withRomanNumerals, withSpelledNumbers } from './guard-numbers.js';
import type { ClauseIndex, IndexedClause } from './retrieval/clause-index.js';
import { cleanInput, fold, lower, stripMarks, words } from './retrieval/text.js';

// The output guard (ADR 0015): every model answer passes through it before the student sees a word.
// It is deterministic, so the red-team suite replays recorded answers through it in CI.
//
// Policy, in order (the first match decides the fallback):
// 1. The internal marker, an 8-word run of the system prompt, or a tool name → noDisclosure.
// 2. A claim to have acted (registered, withdrawn, signed in, paid…, "now on your timetable", "đã được
//    hủy"), any mention of a password, OTP or PIN that is not a warning ("never share", "đổi mật
//    khẩu"), a request for identity data (name, student ID, date of birth…), a promise to store it,
//    or a web address or domain (bare, defanged, protocol-relative, javascript:) that is not on an
//    official HCMUS host (*.hcmus.edu.vn) and, exactly, in a passage the answer cites → cannotAct.
// 3. Code (a fenced block or code-shaped lines) → offTopic.
// 4. A citation [[id]] that is not a real clause or passage, or one the model was not given this
//    turn; an "Điều N" / "Article N" outside the clauses it was given (in any of their documents); another legal document; a
//    quotation (in any quote marks) whose words are not in the clause it cites → ungrounded.
// 5. A number (digits of any script, or words: "thirty", "ba mươi") other than labels and course
//    codes that is not in a clause the answer cites for the same rule (term, programme, bound) or
//    in a record, existing course or engine result of this turn; or arithmetic → ungrounded.
//    Numbers from the regulation search count only once cited.
// 6. A verdict on the standing of the student (a "you/bạn/em/cậu" clause that says eligible, can
//    graduate, meets the requirement, on probation, may register for CSC10002; a bare yes/no) that
//    the rule engine's result this turn does not state, or on the standing of a named person (hard
//    rule 1) → ungrounded. A hedge ("whether", "cannot confirm") covers only its own clause.
// 7. A claim that a cap, prerequisite, approval or requirement is lifted or does not apply, in words
//    no cited clause uses ("there is no credit cap", "không cần học lại") → ungrounded.
// 8. An empty answer, or one with no valid citation and no data tool result, unless it is a short
//    refusal or referral ("I found no clause…, ask the academic affairs office") → ungrounded.
// A replaced answer is replaced whole: a partly wrong academic answer is not shown in part.
// Student IDs, emails and phone numbers are masked in any answer that is shown.

export type GuardReason =
  | 'canary'
  | 'prompt_echo'
  | 'action_claim'
  | 'credential'
  | 'personal_data_request'
  | 'link'
  | 'code'
  | 'unknown_citation'
  | 'citation_not_in_context'
  | 'uncited_article'
  | 'other_document'
  | 'misquote'
  | 'status_claim'
  | 'abolished_rule'
  | 'ungrounded_number'
  | 'ungrounded_answer';

export interface GuardVerdict {
  status: 'passed' | 'replaced';
  text: string;
  reasons: GuardReason[];
  /** The clauses to show as links: the ones cited (passed), or the ones retrieved (replaced). */
  citations: IndexedClause[];
}

export interface GuardInput {
  answer: string;
  language: AdvisorLanguage;
  evidence: TurnEvidence;
  index: ClauseIndex;
  canary: string;
  /** The system prompt as sent, to catch an answer that echoes it. */
  instructions: string;
  /** Names of the tools offered this turn. */
  toolNames: string[];
}

export const LONG_UNGROUNDED_ANSWER = 400;
// What an answer with no citation and no data may do: decline, say no source answers it, or send the
// student elsewhere (UC-08 A6, A7, A10). Anything else uncited ("graduation looks settled for you")
// is replaced: a short claim needs a source as much as a long one.
const DEFLECTION =
  /\b(phong dao tao|phong cong tac sinh vien|phong ctsv|phong khao thi|academic affairs office|academic office|student affairs office|examination office|exams office|found no|no clause|not in my sources|could not find|cannot find|can'?t find|cannot confirm|can'?t confirm|khong tim thay|khong co dieu khoan|khong the xac nhan|chua the xac nhan|ngoai pham vi|outside (that|my|this) scope|trang huong dan|guides page|doi mat khau|change your (portal )?password)\b/;
const SHINGLE = 8;
const CITATION = /\[\[([^\]]{1,120})\]\]/g;
/** A clause or passage id: `qd-1175-2021/d7/k2/b`, `so-tay-2024-2025/hoc-bong/d2/k2`. The index lookup is the real check. */
const CLAUSE_ID = /^[a-z0-9-]+(?:\/[a-z0-9-]+){1,5}$/;

const ACTION_EN = new RegExp(
  [
    /\b(i|i'?ve|i have|we|we'?ve|we have|omnicourse has|the assistant has)\s+(just\s+|already\s+|now\s+|successfully\s+)*(registered|enrolled|signed you up|signed up|dropped|cancelled|canceled|withdrew|withdrawn|logged in|signed in|submitted|filed|paid|emailed|sent|changed|updated|booked)\b/.source,
    // "Withdrawal submitted.", "Your registration has been confirmed."
    /\b(withdrawal|registration|enrol?ment|request|application|payment|form|drop)\s+(has been\s+|have been\s+|was\s+|is\s+)?(successfully\s+)?(submitted|sent|filed|completed|processed|confirmed|done)\b/.source,
    // "You have been withdrawn from MTH00003."
    /\byou\s+(have been|'ve been|are now|were|have now been)\s+(successfully\s+)?(withdrawn|registered|enrolled|unenrolled|dropped|removed|signed up)\b/.source,
    // "I went ahead and dropped MTH00003", "CSC10002 is now on your timetable", "Your withdrawal went through"
    /\b(i|we)\s+(just\s+|already\s+)?(went ahead and|have gone ahead and|took care of|took the liberty|handled)\b/.source,
    /\b(now|already)\s+(on|off|in|added to|removed from)\s+your\s+(timetable|schedule|registration|course list)\b/.source,
    /\b(on|off)\s+your\s+(timetable|schedule)\s+now\b/.source,
    /\b(added to|removed from|dropped from)\s+your\s+(timetable|schedule|registration)\b/.source,
    /\b(withdrawal|registration|enrol?ment|request|application|payment|drop|cancellation|transfer)\s+(has\s+|have\s+)?(went|gone|go)\s+through\b/.source,
    /^\s*(done|all set)\b[^\n]{0,80}([a-z]{2,4}\d{3,5}|timetable|schedule|registration|withdrawal)/.source,
  ].join('|'),
);
// Folded Vietnamese: "đã đăng ký giúp bạn", "mình đã đăng nhập", "đã hủy môn cho bạn", "bạn đã được rút khỏi",
// "môn MTH00003 đã được hủy", "xong rồi nhé, … đã hủy"…
const ACTION_VI = new RegExp(
  [
    /\b(da|vua|se)\s+(dang ky|huy|rut|dang nhap|nop|thanh toan|gui email|gui mail|gui don|doi|cap nhat|sua)\b[^.!?\n]{0,40}\b(giup|cho|thay|ho)\b/.source,
    /\b(minh|toi|tro ly|omnicourse)\s+(da|vua)\s+(dang ky|huy|rut|dang nhap|nop|thanh toan|gui)\b/.source,
    /\bban\s+(da|vua)\s+duoc\s+(rut|dang ky|huy|xoa)\b/.source,
    /\b(don|yeu cau)\b[^.!?\n]{0,30}\bda duoc\s+(gui|nop|xu ly|chap nhan)\b/.source,
    /\b[a-z]{2,4}\d{3,5}\s+(da|vua)\s+(duoc\s+)?(huy|rut|xoa|dang ky|them|chuyen)\b/.source,
    /\b(da|vua)\s+(duoc\s+)?(huy|rut|xoa)\s+(thanh cong|xong|roi)\b/.source,
    /^\s*(xong|xong roi|da xong)\b[^\n]{0,80}([a-z]{2,4}\d{3,5}|dang ky|huy|rut)/.source,
  ].join('|'),
);
// Asking for, or using, a secret or an identity field. A mention is fine ("never needs your password",
// "change your portal password"), and so is a negation just before the verb ("đừng nhập mật khẩu").
const SECRET = '(password|passwd|passcode|otp|mat khau|ma otp|credentials|login details|portal account|tai khoan|thong tin dang nhap)';
const IDENTITY =
  '(full name|your name|student id|student number|date of birth|birthday|national id|citizen id|id number|phone number|email address|home address|ho ten|ho va ten|ma so sinh vien|mssv|ngay sinh|can cuoc|cccd|cmnd|so dien thoai|dia chi email|dia chi nha)';
const ASK =
  "(send|give|provide|share|enter|type|tell|reply with|paste|log in|login|sign in|what's|what is|what are|dm|inbox|fill in|gui|cung cap|nhap|cho minh biet|cho minh xin|cho biet|dang nhap|xac nhan)";
const CREDENTIAL_REQUEST = new RegExp(`\\b${ASK}\\b[^!?]{0,80}?\\b${SECRET}\\b`, 'g');
const IDENTITY_REQUEST = new RegExp(`\\b${ASK}\\b[^!?]{0,80}?\\b${IDENTITY}\\b`, 'g');
/** "MSSV của bạn là bao nhiêu?", "Mật khẩu của bạn là gì?" */
const IDENTITY_QUESTION = new RegExp(`\\b${IDENTITY}\\b[^.!?\\n]{0,30}\\b(la gi|la bao nhieu|la so may|la so nao|is what)\\b`, 'g');
const SECRET_STATED = /\b(your|ban)\s+(\S+\s+){0,2}(password|mat khau|otp)\s+(is|la)\b/;
const STORE_CLAIM = /\b(i will|i'll|i can|i have|i've|let me|we will|minh se|minh da|toi se|toi da|tro ly se)\s+(save|store|remember|keep|record|luu|ghi nho|ghi lai)\b/;
const NEGATED = /(khong|chua|dung|never|don'?t|don’t|do not|does not|doesn'?t|won'?t|will not|no need|not need|needn'?t|without|cannot|can'?t|khong bao gio|khong can|not)\s+(\S+\s+){0,3}$/;
/** "Don't hesitate to send…", "đừng ngại gửi…" is no negation. */
const NOT_A_NEGATION = /(don'?t|do not|dung|never|khong)\s+(hesitate|ngai|ngan ngai|forget|quen)\b/;
// A secret word (password, mật khẩu, mk, OTP, PIN) in an answer is a request unless the words before
// it, in its sentence, warn ("never share", "đừng nhập"), advise changing it, or report what the
// student did ("you just sent"). Default-deny: "What is your portal PIN?", "Hãy dán mật khẩu vào đây".
const SECRET_WORD = /(?<!\p{L})(password|passwords|passwd|passcode|pwd|mat khau|mk|otp|ma otp|pin|ma pin)(?!\p{L})/gu;
const SECRET_SAFE_BEFORE =
  /(never|khong bao gio|no one|nobody|khong ai|don'?t|do not|dung|khong|chua|not|no need|khong can|change|reset|update|doi|thay doi|dat lai|cap nhat|keep|giu|protect|bao ve|ban vua|ban da|you just|you'?ve|you have|you sent|you shared|you typed|you posted|you gave)\s+(\S+\s+){0,6}$/;
const CODE_LINE =
  /^\s*(def |function |class |import |from \S+ import|#include|public (static )?\w|console\.|print\(|SELECT |INSERT |DELETE FROM|UPDATE \S+ SET|<\/?(script|html|div)|\$ |npm |pip |for \w+ in \S.*:\s*$|while .*(<|>|==|!=|True|not ).*:\s*$|return\b|elif |else:\s*$|\w+(\.\w+)*\s*(\+=|-=|\*=)\s*\S)/im;
const DOCUMENT = /\b(thong tu|nghi dinh|quyet dinh|luat|decree|circular|decision|law)\s*(so\s*)?(\d+)/g;
const ARTICLE = /\b(dieu|article|art)\s*\.?\s*(\d+)/g;

/**
 * Blanks a list label ("1. ", "2) ") when it numbers a list: 1, or one more than the label before.
 * "30. that is the figure" after "maximum, in credits:" is the number 30, not a label.
 */
function listLabel(): (m: string, n: string) => string {
  let next = 1;
  return (m, n) => {
    const value = Number(n);
    if (value !== 1 && value !== next) return m;
    next = value + 1;
    return ' '.repeat(m.length);
  };
}

/** Blanks labels and codes whose digits are not rule numbers ("Điều 7, khoản 2", [[ids]], page 87), keeping the text's length. */
function withoutReferences(folded: string): string {
  const blank = (m: string) => ' '.repeat(m.length);
  return folded
    .replace(/\[\[[^\]]*\]\]/g, blank)
    // "khoản 30 tín chỉ" is a number of credits, not a label.
    .replace(/\b(dieu|article|art|khoan|clause)\s*\.?\s*\d+(\s*\.\s*\d+)?[a-z]?\b(?!\s*(tin chi|tc|credits?|courses?|subjects?|terms?|semesters?|hoc phan|mon|hoc ky|tuan|weeks?|percent|%))/g, blank)
    .replace(/\b(diem|point)\s+[a-g]\b/g, blank)
    .replace(/\b(cau|question|buoc|step|part)\s*\d+\b/g, blank)
    .replace(/^\s*(\d{1,2})[.)]\s+(?=[a-z])/gm, listLabel())
    .replace(/\b(qd|quyet dinh)\s*(so\s*)?1175(\s*\/\s*(qd-khtn|qd-dhkhtn|2021))?\b/g, blank)
    .replace(/\b(so tay|handbook)(\s+(sinh vien|sv|student))?(\s+(nam hoc|nh))?\s*\d{4}\s*[-–]\s*\d{4}\b/g, blank)
    .replace(/\b(trang|tr|page|pages|p)\s*\.?\s*\d{1,3}(\s*[-–]\s*\d{1,3})?\b/g, blank);
}

/** A course code as the catalogue writes it: capitals, then digits (CSC10001, CS 163). "only 100" is no code. */
const COURSE_CODE = /(?<![A-Za-z0-9])[A-Z]{2,4}\s?\d{3,5}(?![A-Za-z0-9])/g;

/** Whether a match at `at` in `folded` is negated by the few words before it ("don't send", "không cần nhập"). */
function negated(folded: string, at: number): boolean {
  const before = folded.slice(Math.max(0, at - 40), at);
  if (NOT_A_NEGATION.test(before)) return false;
  // "you just sent your password here" reports what the student did; it asks for nothing.
  return NEGATED.test(before) || /\b(ban|you)\s+(vua|da|vua moi|just|already)\s*$/.test(before);
}

function asks(pattern: RegExp, folded: string): boolean {
  return [...folded.matchAll(pattern)].some((m) => !negated(folded, m.index));
}

/** A secret word used other than in a warning. */
function mentionsSecret(folded: string): boolean {
  for (const m of folded.matchAll(SECRET_WORD)) {
    const sentenceStart = Math.max(...['.', '!', '?', '\n'].map((c) => folded.lastIndexOf(c, m.index - 1))) + 1;
    const before = folded.slice(Math.max(sentenceStart, m.index - 60), m.index);
    if (NOT_A_NEGATION.test(before) || !SECRET_SAFE_BEFORE.test(before)) return true;
  }
  return false;
}

// Bare verdicts: "Yes.", "Có nha", "Sure." — only the rule engine may answer a yes/no about the student.
const BARE_VERDICT =
  /^\s*(yes|no|yep|nope|yeah|sure|absolutely|definitely|of course|correct|exactly|indeed|co|khong|duoc|khong duoc|roi|chua|dung|dung vay|dung roi|chinh xac|chac chan)\s*[—–,:!-]?\s*(not yet|yet|definitely|of course|sure|chua|roi|duoc|nhe|nha|a|vay)?\s*[.!]?\s*$/;
/**
 * Whether the rule engine's result this turn states the claim (hard rule 1): only graduation is in a
 * result the advisor gets (the degree audit's `graduation`). "Not yet" rests on `not_yet`. "You can
 * graduate" rests only on `done` with nothing left unchecked: the audit always leaves conditions to
 * the school (language, IT, defence certificates), so in practice the model may report what the
 * audit found, never that the student can graduate.
 */
function backed(claim: StandingClaim, evidence: TurnEvidence): boolean {
  const g = evidence.graduation;
  if (!claim.graduation || !g) return false;
  return claim.polarity === 'negative' ? g.status === 'not_yet' : g.status === 'done' && g.notChecked === 0;
}

// Quotations, in any quote marks. One must be, word for word, in a clause the answer cites: those
// cited in its sentence, or any cited clause when its sentence cites none.
/** Paired quotation marks other than straight double quotes, which are paired in order instead. */
const PAIRED_QUOTE = /“([^”]{12,1500}?)”|«\s*([^»]{12,1500}?)\s*»|„([^“”]{12,1500}?)[“”]|‘([^’\n]{12,300}?)’|(?<![\p{L}\p{N}])'([^'\n]{12,300}?)'(?![\p{L}\p{N}])|「([^」]{12,1500}?)」/gu;

/** The quotations of a text: straight double quotes paired first with second, third with fourth…, then the other marks. */
function quotationsIn(text: string): { start: number; end: number; quote: string }[] {
  const out: { start: number; end: number; quote: string }[] = [];
  const straight = [...text.matchAll(/"/g)].map((m) => m.index);
  for (let k = 0; k + 1 < straight.length; k += 2) {
    const quote = text.slice(straight[k] + 1, straight[k + 1]);
    if (quote.length >= 12) out.push({ start: straight[k], end: straight[k + 1] + 1, quote });
  }
  for (const m of text.replace(/"/g, ' ').matchAll(PAIRED_QUOTE)) out.push({ start: m.index, end: m.index + m[0].length, quote: m.slice(1).find((g) => g !== undefined)! });
  return out.sort((a, b) => a.start - b.start);
}

/** The quotations of an answer: whether one is not in the clause it cites, and where the faithful ones are. */
function quotations(text: string, index: ClauseIndex, cited: IndexedClause[]): { misquoted: boolean; faithful: [number, number][] } {
  const faithful: [number, number][] = [];
  let misquoted = false;
  const idsIn = (s: string) => [...s.matchAll(/\[\[([^\]]+)\]\]/g)].map(([, id]) => index.get(id.trim())).filter((c) => c !== undefined);
  for (const { start, end, quote } of quotationsIn(text)) {
    // Its sentence: up to the first end of sentence not followed by a citation, and back to the previous one.
    const after = text.slice(end);
    const stop = after.search(/[.!?](?!\d)\s+(?!\[\[)|\n/);
    const before = text.slice(0, start);
    const startAt = Math.max(before.lastIndexOf('. '), before.lastIndexOf('\n'), before.lastIndexOf('! '), before.lastIndexOf('? ')) + 1;
    let sources = idsIn(stop < 0 ? after : after.slice(0, stop + 1));
    if (!sources.length) sources = idsIn(before.slice(startAt));
    if (!sources.length) sources = cited;
    if (!sources.length) continue; // No citation anywhere: the grounding check replaces the answer.
    const haystacks = sources.map((c) => ` ${words(c.text).join(' ')} `);
    let ok = true;
    for (const piece of quote.split(/\.\.\.|…|\[…\]/)) {
      const ws = words(piece);
      if (ws.length < 3) continue;
      if (!haystacks.some((h) => h.includes(` ${ws.join(' ')} `))) ok = false;
    }
    if (ok) faithful.push([start, end]);
    else misquoted = true;
  }
  return { misquoted, faithful };
}

// Web addresses and domains. Default-deny: a link is shown only when its host is an official HCMUS
// host (hcmus.edu.vn and its subdomains, the hosts the Guides page uses) and the address is, exactly,
// in a passage the answer cites. Defanged ("hxxps", "[.]") and protocol-relative ("//") addresses are
// read as addresses, and javascript:, vbscript: and data: URLs are never shown.
const OFFICIAL_HOST = /(^|\.)hcmus\.edu\.vn$/;
const NOT_A_HOST = new Set(['e.g', 'i.e', 'tp.hcm', 'v.v', 'th.s', 'pgs.ts', 'gs.ts', 'a.m', 'p.m']);
const DANGEROUS_SCHEME = /(?<![\p{L}\p{N}])(javascript|vbscript|livescript)\s*:|(?<![\p{L}\p{N}])data\s*:\s*[a-z]+\/[a-z]/iu;
const ADDRESS = /(?:[a-z][a-z0-9+.-]*:)?\/\/[^\s<>"'()[\]]+|(?<![\p{L}\p{N}@._-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9](?![\p{L}\p{N}-])(?:\/[^\s<>"'()[\]]*)?/giu;

// Hosts in other scripts. NFKC (cleanInput) already made full-width and small full stops '.'; the
// ideographic ones stay, so they are read as dots too. A host with a letter outside the Latin script
// (a Cyrillic or Greek lookalike: "portal.hсmus.edu.vn", a host in another script, mixed script), a
// Latin host with diacritics before an ASCII top-level domain ("hcmüs.edu.vn"), or a punycode label
// that decodes to anything but ASCII is never official; ASCII hosts go on to the allowlist.
const IDEOGRAPHIC_DOT = /[\u3002\uFF61\uFF0E\uFE52\u2024]/gu;
const ANY_SCRIPT_HOST = /(?<![\p{L}\p{N}@._-])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+\p{L}[\p{L}\p{N}-]*\p{L}(?![\p{L}\p{N}-])/gu;
const NON_LATIN_LETTER = /(?!\p{Script=Latin})\p{L}/u;
const NON_ASCII = /[^\x00-\x7f]/;

function foreignHost(plain: string): boolean {
  for (const [host] of plain.matchAll(ANY_SCRIPT_HOST)) {
    if (!NON_ASCII.test(host)) {
      if (/(^|\.)xn--/i.test(host) && NON_ASCII.test(domainToUnicode(host.toLowerCase()) || 'xn--')) return true;
      continue;
    }
    if (NON_LATIN_LETTER.test(host)) return true;
    if (!NON_ASCII.test(host.split('.').at(-1)!)) return true;
  }
  return false;
}

const defang = (text: string): string =>
  text
    .replace(IDEOGRAPHIC_DOT, '.')
    .replace(/\s*[[({]\s*(\.|dot)\s*[\])}]\s*/gi, '.')
    .replace(/\s+dot\s+(?=[a-z]{2,}\b)/gi, '.')
    .replace(/\[:\]/g, ':')
    .replace(/\bh[xX]{2}p(s?):/g, 'http$1:');

function unlistedLink(text: string, cited: IndexedClause[]): boolean {
  const plain = defang(text.replace(/\[\[[^\]]*\]\]/g, ' '));
  if (DANGEROUS_SCHEME.test(plain) || foreignHost(plain)) return true;
  for (const [raw] of plain.matchAll(ADDRESS)) {
    const url = raw.replace(/[.,;:!?]+$/u, '');
    const host = url.replace(/^[a-z][a-z0-9+.-]*:/i, '').replace(/^\/\//, '').split(/[/?#:]/)[0].toLowerCase();
    if (NOT_A_HOST.has(host)) continue;
    if (!OFFICIAL_HOST.test(host) || !cited.some((c) => c.text.includes(url))) return true;
  }
  return false;
}

/** Sentences of an answer; a decimal point or comma inside a number does not end one. */
function sentences(text: string): string[] {
  return text.split(/(?<!\d)[.!?](?!\d)|\n+/).filter((s) => s.trim());
}

function shingles(text: string): Set<string> {
  // Clause ids are not prompt text: the prompt's example id and a real citation are alike.
  const ws = words(text.replace(/\[\[[^\]]*\]\]|[a-z0-9-]+\/d\d+(\/[a-z0-9-]+)*/gi, ' '));
  const out = new Set<string>();
  for (let i = 0; i + SHINGLE <= ws.length; i++) out.add(ws.slice(i, i + SHINGLE).join(' '));
  return out;
}

/** The parts of the prompt an answer must never repeat: everything but the fixed replies it is told to give and the quoted clauses. */
function secretPart(instructions: string): string {
  let secret = instructions.split('<reference_clauses')[0];
  for (const reply of Object.values(FIXED_REPLIES)) for (const text of Object.values(reply)) secret = secret.split(text).join(' ');
  return secret;
}

/** Masks a student ID (8–10 digits), an email address (also written "name [at] host [dot] com") or a phone number in an answer that is shown. */
export function maskPersonalData(text: string): string {
  return text
    .replace(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[a-z]{2,}/giu, '[…]')
    .replace(/[\p{L}\p{N}._%+-]+\s*[[(]\s*at\s*[\])]\s*[\p{L}\p{N}-]+(?:\s*(?:[[(]\s*(?:dot|\.)\s*[\])]|\.)\s*[\p{L}\p{N}-]+)+/giu, '[…]')
    .replace(/(?<![\d.,])(\+?84|0)\d{9,10}(?!\d|[.,]\d)/g, '[…]')
    .replace(/(?<![\d.,])\d{8,10}(?!\d|[.,]\d)/g, '[…]');
}

/** A course code as a word without digits ("CSC10001" → "cscbaaab"), so its digits are no number but the code can still be found. */
export const codeWord = (code: string): string => code.replace(/\s/g, '').toLowerCase().replace(/\d/g, (d) => 'abcdefghij'[Number(d)]);

/** Numbers of a text as the guard reads them: lower case, numbers in words as digits, labels blanked, codes as words. */
function readNumbers(text: string): { spelled: string; numbers: { value: number; at: number }[] } {
  const spelled = withSpelledNumbers(lower(withRomanNumerals(text.replace(COURSE_CODE, codeWord))));
  return { spelled, numbers: numbersAt(withoutReferences(foldSameLength(spelled))) };
}

/** Words that make a phrase about the student's own record: "your record shows…", "MTH00003 của bạn…". */
const OWN_RECORD = /(?<!\p{L})(you|your|yours|u|ban|em|cau|record|transcript|audit|ho so|bang diem|ket qua hoc tap)(?!\p{L})/u;

/**
 * Whether a number a tool returned grounds this one: only where the sentence, up to the end of the
 * number's phrase, is about that course (its code) or, for a record or plan tool, the student's own
 * record. "A student is dismissed after 4 warnings, and CSC10001 is core" does not get 4 from
 * CSC10001's credits; "a grade of 4.5 passes" does not get 4.5 from the student's grade.
 */
function groundedByTool(value: number, scope: string, evidence: TurnEvidence): boolean {
  const folded = stripMarks(scope);
  return evidence.tools.some(
    (t) => t.ok && t.name !== 'search_regulations' && t.numbers.has(value) && ([...t.codes].some((c) => folded.includes(codeWord(c))) || (t.record && OWN_RECORD.test(folded))),
  );
}

/** Clause texts as numbers are read there: lower case, numbers in words as digits. */
const clauseNumbers = new WeakMap<IndexedClause, { spelled: string; numbers: { value: number; at: number }[] }>();
function numbersOfClause(c: IndexedClause) {
  let found = clauseNumbers.get(c);
  if (!found) {
    const spelled = withSpelledNumbers(lower(c.text));
    found = { spelled, numbers: numbersAt(foldSameLength(spelled)) };
    clauseNumbers.set(c, found);
  }
  return found;
}

/** The numbers of an answer that no cited clause states for the same rule and no tool returned. */
function ungroundedNumbers(claimText: string, cited: IndexedClause[], evidence: TurnEvidence): boolean {
  const { spelled, numbers } = readNumbers(claimText);
  // Arithmetic is computing, which only the engine does: "25 + 12".
  if (/\d\s*[+×*=]\s*\d/.test(withoutReferences(foldSameLength(spelled)))) return true;
  for (const n of numbers) {
    const sentenceStart = Math.max(...['.', '!', '?', '\n'].map((c) => lastBoundary(spelled, c, n.at))) + 1;
    const nextEnd = spelled.slice(n.at).search(/(?<!\d)[.!?](?!\d)|\n/);
    const sentence = spelled.slice(sentenceStart, nextEnd < 0 ? undefined : n.at + nextEnd);
    const phrase = phrases(sentence).filter((p) => p.at <= n.at - sentenceStart).at(-1)!;
    const answer = nearest([qualifiersOf(phrase.text), qualifiersOf(sentence)]);
    const sourced = cited.some((c) => {
      const clause = numbersOfClause(c);
      return clause.numbers.some((s) => s.value === n.value && sameRule(answer, sourceQualifiers(clause.spelled, s.at)));
    });
    if (!sourced && !groundedByTool(n.value, sentence.slice(0, phrase.at + phrase.text.length), evidence)) return true;
  }
  return false;
}

/** The last sentence end before `at` (a "." between digits is a decimal point). */
function lastBoundary(text: string, mark: string, at: number): number {
  let i = text.lastIndexOf(mark, at - 1);
  while (i > 0 && mark === '.' && /\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? '')) i = text.lastIndexOf(mark, i - 1);
  return i;
}

export function guardAnswer(input: GuardInput): GuardVerdict {
  const { language, evidence, index } = input;
  const text = cleanInput(input.answer).trim();
  // The fixed replies are what the prompt tells the model to say; they are checked as safe here, so
  // the checks below read the rest ("never needs your password" is not a credential request).
  const rest = withoutFixedReplies(text);
  const folded = fold(rest);
  const reasons: GuardReason[] = [];

  // 1. Disclosure
  if (input.canary && fold(text).includes(fold(input.canary))) reasons.push('canary');
  const secret = shingles(secretPart(input.instructions));
  if ([...shingles(rest)].some((s) => secret.has(s)) || /prompt advisor-\d|internal marker/.test(folded) || input.toolNames.some((n) => folded.includes(n))) {
    reasons.push('prompt_echo');
  }
  // 2. Acting, secrets, identity data
  if (ACTION_EN.test(folded) || ACTION_VI.test(folded)) reasons.push('action_claim');
  if (mentionsSecret(folded) || asks(CREDENTIAL_REQUEST, folded) || SECRET_STATED.test(folded)) reasons.push('credential');
  if (asks(IDENTITY_REQUEST, folded) || asks(IDENTITY_QUESTION, folded) || STORE_CLAIM.test(folded)) reasons.push('personal_data_request');
  // 3. Code
  if (text.includes('```') || CODE_LINE.test(rest)) reasons.push('code');

  // 4. Citations, references, quotations, links
  const cited: IndexedClause[] = [];
  for (const [, raw] of text.matchAll(CITATION)) {
    const id = raw.trim();
    const clause = CLAUSE_ID.test(id) ? index.get(id) : undefined;
    if (!clause) reasons.push('unknown_citation');
    else if (!evidence.clauses.has(id)) reasons.push('citation_not_in_context');
    else if (!cited.includes(clause)) cited.push(clause);
  }
  if (unlistedLink(rest, cited)) reasons.push('link');
  const contextArticles = new Set([...evidence.clauses.values()].flatMap((c) => (c.article ? [c.article.number] : [])));
  for (const [, , n] of withoutCitations(folded).matchAll(ARTICLE)) if (!contextArticles.has(Number(n))) reasons.push('uncited_article');
  const contextNumbers = new Set([...evidence.clauses.values()].flatMap((c) => numbersOfClause(c).numbers.map((x) => x.value)));
  for (const [, , , n] of folded.matchAll(DOCUMENT)) if (n !== '1175' && !contextNumbers.has(Number(n))) reasons.push('other_document');
  const quotes = quotations(rest, index, cited);
  if (quotes.misquoted) reasons.push('misquote');

  // What the answer claims in its own words: faithful quotations out, citations as sentence ends.
  let claimText = rest;
  for (const [from, to] of [...quotes.faithful].reverse()) claimText = `${claimText.slice(0, from)} ${claimText.slice(to)}`;
  claimText = claimText.replace(/\[\[[^\]]*\]\]/g, '\n');
  const lowered = lower(claimText);
  const claimFolded = stripMarks(lowered);

  // 5. Numbers: each one from a cited clause, for the same rule, or from a record, course or engine result.
  if (ungroundedNumbers(claimText, cited, evidence)) reasons.push('ungrounded_number');
  // 6. A verdict on the student's standing that the engine did not give, or on a named person's.
  // An answer typed without diacritics: "ban" is then "bạn" (with them it may be "bản", a document).
  const plain = !/[\u0300-\u036f]|đ/i.test(rest.normalize('NFD'));
  const bare = sentences(claimFolded).filter((s) => s.trim());
  if (bare.length > 0 && BARE_VERDICT.test(bare[0])) reasons.push('status_claim');
  if (standingClaims(lowered, plain).some((c) => !backed(c, evidence)) || namedStandingClaim(claimText, lowered)) reasons.push('status_claim');
  // 7. A rule said to be lifted or not to apply
  if (abolishedRule(lowered, cited.map((c) => fold(c.text)))) reasons.push('abolished_rule');
  // 8. Grounded in nothing: no citation and no data. Only a short refusal or referral may stand, and
  //    an uncited answer is checked whatever its length ("Sure.", "Được nha.").
  if (!text) reasons.push('ungrounded_answer');
  else if (cited.length === 0 && !evidence.hasDataResult && /[\p{L}\p{N}]/u.test(rest) && (rest.trim().length > LONG_UNGROUNDED_ANSWER || !DEFLECTION.test(fold(rest)))) {
    reasons.push('ungrounded_answer');
  }

  const unique = [...new Set(reasons)];
  if (unique.length === 0) return { status: 'passed', text: maskPersonalData(text), reasons: [], citations: cited };
  return { status: 'replaced', text: fallbackFor(unique, language), reasons: unique, citations: [...evidence.clauses.values()].slice(0, 5) };
}

function withoutFixedReplies(text: string): string {
  let rest = text;
  for (const reply of Object.values(FIXED_REPLIES)) for (const t of Object.values(reply)) rest = rest.split(t).join(' ');
  return rest;
}

const withoutCitations = (folded: string): string => folded.replace(/\[\[[^\]]*\]\]/g, ' ');

function fallbackFor(reasons: GuardReason[], language: AdvisorLanguage): string {
  const has = (...r: GuardReason[]) => r.some((x) => reasons.includes(x));
  if (has('canary', 'prompt_echo')) return FIXED_REPLIES.noDisclosure[language];
  if (has('action_claim', 'credential', 'personal_data_request', 'link')) return FIXED_REPLIES.cannotAct[language];
  if (has('code')) return FIXED_REPLIES.offTopic[language];
  return FIXED_REPLIES.ungrounded[language];
}
