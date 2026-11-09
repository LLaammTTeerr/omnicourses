import { type AdvisorLanguage, FIXED_REPLIES } from './advisor-prompt.js';
import { numbersIn, type TurnEvidence } from './advisor-tools.js';
import type { ClauseIndex, IndexedClause } from './retrieval/clause-index.js';
import { cleanInput, fold, words } from './retrieval/text.js';

// The output guard (ADR 0015): every model answer passes through it before the student sees a word.
// It is deterministic, so the red-team suite replays recorded answers through it in CI.
//
// Policy, in order (the first match decides the fallback):
// 1. The internal marker, an 8-word run of the system prompt, or a tool name → noDisclosure.
// 2. A claim to have acted (registered, withdrawn, signed in, paid…), a request for a password, an
//    OTP or identity data (name, student ID, date of birth…), a promise to store it, or a link → cannotAct.
// 3. Code (a fenced block or code-shaped lines) → offTopic.
// 4. A citation [[id]] that is not a real clause, or a real clause the model was not given this
//    turn; an "Điều N" / "Article N" outside the clauses it was given; another legal document; a
//    quotation followed by a citation whose words are not in the cited clause → ungrounded.
// 5. A number (other than labels, course codes and list markers) that is not in a clause the answer
//    cites or in a record, course or engine result of this turn → ungrounded. Numbers from the
//    regulation search count only once cited.
// 6. A verdict on the student's own standing (eligible, can graduate, meets the requirement, on
//    probation, may register for CSC10002, a bare yes/no) with no rule-engine result this turn
//    (hard rule 1) → ungrounded.
// 7. A long answer (over 400 characters) with no valid citation and no data tool result → ungrounded.
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
const SHINGLE = 8;
const CITATION = /\[\[([^\]]{1,120})\]\]/g;
const CLAUSE_ID = /^[a-z0-9-]+\/d\d+(?:-\d+)?(?:\/k\d+(?:-\d+)?(?:\/[a-z]{1,2}(?:-\d+)?)?)?$/;

const ACTION_EN = new RegExp(
  [
    /\b(i|i'?ve|i have|we|we'?ve|we have|omnicourse has|the assistant has)\s+(just\s+|already\s+|now\s+|successfully\s+)*(registered|enrolled|signed you up|signed up|dropped|cancelled|canceled|withdrew|withdrawn|logged in|signed in|submitted|filed|paid|emailed|sent|changed|updated|booked)\b/.source,
    // "Withdrawal submitted.", "Your registration has been confirmed."
    /\b(withdrawal|registration|enrol?ment|request|application|payment|form|drop)\s+(has been\s+|have been\s+|was\s+|is\s+)?(successfully\s+)?(submitted|sent|filed|completed|processed|confirmed|done)\b/.source,
    // "You have been withdrawn from MTH00003."
    /\byou\s+(have been|'ve been|are now|were|have now been)\s+(successfully\s+)?(withdrawn|registered|enrolled|unenrolled|dropped|removed|signed up)\b/.source,
  ].join('|'),
);
// Folded Vietnamese: "đã đăng ký giúp bạn", "mình đã đăng nhập", "đã hủy môn cho bạn", "bạn đã được rút khỏi"…
const ACTION_VI =
  /\b(da|vua|se)\s+(dang ky|huy|rut|dang nhap|nop|thanh toan|gui email|gui mail|gui don|doi|cap nhat|sua)\b[^.!?\n]{0,40}\b(giup|cho|thay|ho)\b|\b(minh|toi|tro ly|omnicourse)\s+(da|vua)\s+(dang ky|huy|rut|dang nhap|nop|thanh toan|gui)\b|\bban\s+(da|vua)\s+duoc\s+(rut|dang ky|huy|xoa)\b|\b(don|yeu cau)\b[^.!?\n]{0,30}\bda duoc\s+(gui|nop|xu ly|chap nhan)\b/;
// Asking for, or using, a secret or an identity field. A mention is fine ("never needs your password",
// "change your portal password"), and so is a negation just before the verb ("đừng nhập mật khẩu").
const SECRET = '(password|passwd|passcode|otp|mat khau|ma otp|credentials|login details|portal account|tai khoan|thong tin dang nhap)';
const IDENTITY =
  '(full name|your name|student id|student number|date of birth|birthday|national id|citizen id|id number|phone number|email address|home address|ho ten|ho va ten|ma so sinh vien|mssv|ngay sinh|can cuoc|cccd|cmnd|so dien thoai|dia chi email|dia chi nha)';
const ASK = "(send|give|provide|share|enter|type|tell|reply with|paste|log in|login|sign in|what's|what is|gui|cung cap|nhap|cho minh biet|cho minh xin|dang nhap|xac nhan)";
const CREDENTIAL_REQUEST = new RegExp(`\\b${ASK}\\b[^!?]{0,80}?\\b${SECRET}\\b`, 'g');
const IDENTITY_REQUEST = new RegExp(`\\b${ASK}\\b[^!?]{0,80}?\\b${IDENTITY}\\b`, 'g');
const SECRET_STATED = /\b(your|ban)\s+(\S+\s+){0,2}(password|mat khau|otp)\s+(is|la)\b/;
const STORE_CLAIM = /\b(i will|i'll|i can|i have|i've|let me|we will|minh se|minh da|toi se|toi da|tro ly se)\s+(save|store|remember|keep|record|luu|ghi nho|ghi lai)\b/;
const NEGATED = /(khong|chua|dung|never|don'?t|don’t|do not|does not|doesn'?t|won'?t|will not|no need|not need|needn'?t|without|cannot|can'?t|khong bao gio|khong can|not)\s+(\S+\s+){0,3}$/;
const LINK = /\bhttps?:\/\/|\bwww\.[a-z0-9-]+\.|\b[a-z0-9-]+\.(com|net|org|io|vn|me|ly|app|xyz)\/\S/;
const CODE_LINE = /^\s*(def |function |class |import |from \S+ import|#include|public (static )?\w|console\.|print\(|SELECT |INSERT |DELETE FROM|UPDATE \S+ SET|<\/?(script|html|div)|\$ |npm |pip )/im;
const DOCUMENT = /\b(thong tu|nghi dinh|quyet dinh|luat|decree|circular|decision|law)\s*(so\s*)?(\d+)/g;
const ARTICLE = /\b(dieu|article|art)\s*\.?\s*(\d+)/g;

/** Removes labels and codes whose digits are not rule numbers: "Điều 7, khoản 2, điểm b", CSC10001, [[ids]]. */
function withoutReferences(folded: string): string {
  return folded
    .replace(/\[\[[^\]]*\]\]/g, ' ')
    .replace(/\b(dieu|article|art|khoan|clause)\s*\.?\s*\d+(\s*\.\s*\d+)?[a-z]?\b/g, ' ')
    .replace(/\b(diem|point)\s+[a-g]\b/g, ' ')
    .replace(/\b(cau|question|buoc|step|part)\s*\d+\b/g, ' ')
    .replace(/^\s*\d{1,2}[.)]\s+(?=[a-z])/gm, ' ')
    .replace(/\b(qd|quyet dinh)\s*(so\s*)?1175(\s*\/\s*(qd-khtn|qd-dhkhtn|2021))?\b/g, ' ')
    .replace(/\b[a-z]{2,4}\s?\d{3,5}\b/g, ' ');
}

/** Whether a match at `at` in `folded` is negated by the few words before it ("don't send", "không cần nhập"). */
function negated(folded: string, at: number): boolean {
  const before = folded.slice(Math.max(0, at - 40), at);
  // "you just sent your password here" reports what the student did; it asks for nothing.
  return NEGATED.test(before) || /\b(ban|you)\s+(vua|da|vua moi|just|already)\s*$/.test(before);
}

function asks(pattern: RegExp, folded: string): boolean {
  return [...folded.matchAll(pattern)].some((m) => !negated(folded, m.index));
}

// A verdict on the student's own standing. Hard rule 1: only the rule engine decides these, so one
// is shown only when an engine result came back this turn. A sentence that hedges ("I cannot confirm
// whether you can graduate") is not a verdict.
const STATUS_EN = new RegExp(
  [
    /\b(you|this student|the student)\s+(are|'re|is|are not|aren't|is not|are now|will be|would be|is therefore|are therefore)\s+(not\s+|now\s+|already\s+|fully\s+)*(eligible|qualified|on (academic )?probation|under (an )?academic warning|allowed to (graduate|register|take|enrol))/.source,
    /\byou\s+(can|cannot|can't|could|may|may not|will|will not|won't|should be able to)\s+(not\s+|still\s+|now\s+)*graduate\b/.source,
    // "you're on track to graduate", "you are cleared for graduation"
    /\byou('re| are| will be)\s+(\S+\s+){0,3}(to graduate|for graduation)\b/.source,
    /\b(you|this student|the student)\s+(meet|meets|has met|has satisfied|has fulfilled|has completed all|do not meet|don't meet|have met|have not met|haven't met|satisfy|do not satisfy|don't satisfy|have satisfied|fulfil|fulfill|have fulfilled|have completed all)\s+(all\s+)?(of\s+)?(the\s+|your\s+)?(graduation|requirements?|prerequisites?|conditions?|degree)/.source,
    /\byou\s+(can|cannot|can't|may|may not|are allowed to|are not allowed to)\s+(register for|take|enrol in|enroll in)\s+[a-z]{2,4}\s?\d{3,5}/.source,
    /\byou\s+(will|would)\s+(be|get)\s+(expelled|dismissed|suspended|a warning|an academic warning|put on probation)/.source,
  ].join('|'),
);
const STATUS_VI = new RegExp(
  [
    /\bban\s+(da\s+|van\s+|chua\s+|khong\s+|se\s+|hien\s+)*(du|khong du|chua du)\s+dieu kien/.source,
    /\bban\s+(da\s+|chua\s+|khong\s+|se\s+|van\s+)*(duoc|co the|khong the)\s+(xet\s+)?tot nghiep/.source,
    /\bban\s+(da\s+|chua\s+|se\s+)*(dap ung|khong dap ung|chua dap ung)/.source,
    /\bban\s+(dang\s+|da\s+|se\s+)*(bi|khong bi)\s+(canh bao|buoc thoi hoc|dinh chi|xu ly hoc vu)/.source,
    /\bban\s+(duoc|khong duoc|co the|khong the)\s+(dang ky|hoc)\s+(mon\s+|hoc phan\s+)?[a-z]{2,4}\s?\d{3,5}/.source,
  ].join('|'),
);
const HEDGE =
  /\b(whether|if you|if your|cannot confirm|can'?t confirm|cannot check|can'?t check|unable to confirm|not able to confirm|cannot tell|can'?t tell|khong the xac nhan|chua the xac nhan|khong xac nhan duoc|chua xac nhan duoc|hay khong|lieu|neu ban|khi ban)\b/;
const BARE_VERDICT =
  /^\s*(yes|no|yep|nope|yeah|co|khong|duoc|khong duoc|roi|chua)\s*[—–,:-]?\s*(not yet|yet|definitely|of course|sure|chua|roi|duoc|nhe|a)?\s*[.!]?\s*$/;

// Spelled-out decimals ("năm phẩy không", "five point zero") are numbers too.
const DIGIT_WORDS: Record<string, string> = {
  khong: '0', mot: '1', hai: '2', ba: '3', bon: '4', tu: '4', nam: '5', sau: '6', bay: '7', tam: '8', chin: '9', muoi: '10',
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
};
const DIGIT = Object.keys(DIGIT_WORDS).join('|');
const SPELLED_DECIMAL = new RegExp(`\\b(${DIGIT})\\s+(phay|cham|point)\\s+(${DIGIT})\\b`, 'g');
const withDigits = (folded: string): string => folded.replace(SPELLED_DECIMAL, (_m, a: string, _p, b: string) => ` ${DIGIT_WORDS[a]}.${DIGIT_WORDS[b]} `);

function statusClaim(folded: string, cited: number): boolean {
  const parts = sentences(folded);
  if (parts.length === 1 && BARE_VERDICT.test(parts[0])) return true;
  if (cited === 0 && parts.length > 0 && BARE_VERDICT.test(parts[0])) return true;
  return parts.some((s) => !HEDGE.test(s) && (STATUS_EN.test(s) || STATUS_VI.test(s)));
}

const QUOTED = /["“]([^"”]{12,}?)["”][\s.,;:)]*((?:\[\[[^\]]{1,120}\]\][\s,;]*)+)/g;

/** A quotation directly followed by citations must be, word for word, in one of the clauses it cites (an ellipsis may cut it). */
function misquoted(text: string, index: ClauseIndex): boolean {
  for (const [, quote, citations] of text.matchAll(QUOTED)) {
    const sources = [...citations.matchAll(/\[\[([^\]]+)\]\]/g)].map(([, id]) => index.get(id.trim())).filter((c) => c !== undefined);
    if (!sources.length) continue; // An unknown citation is caught on its own.
    const haystacks = sources.map((c) => ` ${words(c.text).join(' ')} `);
    for (const piece of quote.split(/\.\.\.|…|\[…\]/)) {
      const ws = words(piece);
      if (ws.length < 3) continue;
      if (!haystacks.some((h) => h.includes(` ${ws.join(' ')} `))) return true;
    }
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

/** Masks a student ID (8–10 digits), an email address or a phone number in an answer that is shown. */
export function maskPersonalData(text: string): string {
  return text
    .replace(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[a-z]{2,}/giu, '[…]')
    .replace(/(?<![\d.,])(\+?84|0)\d{9,10}(?!\d|[.,]\d)/g, '[…]')
    .replace(/(?<![\d.,])\d{8,10}(?!\d|[.,]\d)/g, '[…]');
}

export function guardAnswer(input: GuardInput): GuardVerdict {
  const { language, evidence, index } = input;
  const text = cleanInput(input.answer).trim();
  // The fixed replies are what the prompt tells the model to say; they are checked as safe here, so
  // the checks below read the rest ("never needs your password" is not a credential request).
  const folded = fold(withoutFixedReplies(text));
  const reasons: GuardReason[] = [];

  // 1. Disclosure
  if (input.canary && folded.includes(fold(input.canary))) reasons.push('canary');
  const secret = shingles(secretPart(input.instructions));
  if ([...shingles(withoutFixedReplies(text))].some((s) => secret.has(s)) || /prompt advisor-\d|internal marker/.test(folded) || input.toolNames.some((n) => folded.includes(n))) {
    reasons.push('prompt_echo');
  }
  // 2. Acting, secrets, identity data, links
  if (ACTION_EN.test(folded) || ACTION_VI.test(folded)) reasons.push('action_claim');
  if (asks(CREDENTIAL_REQUEST, folded) || SECRET_STATED.test(folded)) reasons.push('credential');
  if (asks(IDENTITY_REQUEST, folded) || STORE_CLAIM.test(folded)) reasons.push('personal_data_request');
  if (LINK.test(folded)) reasons.push('link');
  // 3. Code
  if (text.includes('```') || CODE_LINE.test(withoutFixedReplies(text))) reasons.push('code');

  // 4. Citations and references
  const cited: IndexedClause[] = [];
  for (const [, raw] of text.matchAll(CITATION)) {
    const id = raw.trim();
    const clause = CLAUSE_ID.test(id) ? index.get(id) : undefined;
    if (!clause) reasons.push('unknown_citation');
    else if (!evidence.clauses.has(id)) reasons.push('citation_not_in_context');
    else if (!cited.includes(clause)) cited.push(clause);
  }
  const contextArticles = new Set([...evidence.clauses.values()].map((c) => c.article.number));
  for (const [, , n] of withoutCitations(folded).matchAll(ARTICLE)) if (!contextArticles.has(Number(n))) reasons.push('uncited_article');
  const contextNumbers = new Set([...evidence.clauses.values()].flatMap((c) => [...numbersIn(c.text)]));
  for (const [, , , n] of folded.matchAll(DOCUMENT)) if (n !== '1175' && !contextNumbers.has(Number(n))) reasons.push('other_document');
  if (misquoted(text, index)) reasons.push('misquote');

  // 5. Numbers: every one must come from a cited clause or a record, course or engine result.
  const grounded = new Set<number>([
    ...cited.flatMap((c) => [...numbersIn(c.text)]),
    ...evidence.tools.filter((t) => t.ok && t.name !== 'search_regulations').flatMap((t) => [...t.numbers]),
  ]);
  if ([...numbersIn(withoutReferences(withDigits(folded)))].some((n) => !grounded.has(n))) reasons.push('ungrounded_number');
  // 6. A verdict on the student's standing without the engine
  if (!evidence.engineAnswered && statusClaim(folded, cited.length)) reasons.push('status_claim');
  // 7. Long and grounded in nothing
  if (withoutFixedReplies(text).trim().length > LONG_UNGROUNDED_ANSWER && cited.length === 0 && !evidence.hasDataResult) reasons.push('ungrounded_answer');

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
