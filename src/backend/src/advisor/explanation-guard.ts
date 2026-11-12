import { type AdvisorLanguage, EXPLANATION_RULES, FIXED_REPLIES } from './advisor-prompt.js';
import { withRomanNumerals, withSpelledNumbers } from './number-reader.js';
import type { ClauseIndex } from './retrieval/clause-index.js';
import { cleanInput, fold, lower, words } from './retrieval/text.js';

// The explanation guard (ADR 0015, option A; Lâm, 12 Nov 2026). The model's own words are the only
// text of an answer the server does not write, and they may only explain and point: "these passages
// cover retakes; see your degree audit for your results". Verdicts, rules and numbers come from the
// engine facts and the passages, which the server shows in its own or the school's words.
//
// Default-deny and without exemptions: the free-text guard this replaces let verdicts through its
// exemptions (a hedge, a refutation, a grounded number), and a blind red team found 79 of 105 hostile
// replies shown. Here the explanation is rejected if it has any of these, wherever they are:
// - a number in any form (digits of any script, number words, Roman or CJK numerals, multiples,
//   fractions), and so any course code or date;
// - a quotation mark, a web address or domain, an e-mail sign, markup, code, an emoji or a chat role
//   label such as "SYSTEM:" (only letters, spaces and plain punctuation are allowed);
// - a first- or second-person word (I, we, you, mình, bạn, em…) outside the fixed pointer "see your
//   degree audit / xem bảng xét tốt nghiệp của bạn", or a third-person one (he, she, his);
// - a verdict, permission, modal or negation word (yes, no, not, can, may, must, eligible, allowed,
//   optional, được, phải, cần, không, đủ điều kiện…), a word on whether a rule still holds
//   (abolished, repealed, bãi bỏ…) or an order to set the sources aside (ignore, phớt lờ), or a word that places it in time (now, already,
//   this term, đã, đang, kỳ này…);
// - a word about secrets, identity data, contact channels or acting (password, OTP, MSSV, Zalo,
//   registered…);
// - the internal marker, an 8-word run of the system prompt, or a tool name;
// - a sentence with no word the regulation or the handbook knows (a poem, a joke), or a function word
//   of another language (the lists above read English and Vietnamese only);
// - more than 600 characters or 4 sentences, or a citation of a passage the answer does not show.
// A rejected explanation is dropped; the passages and facts the answer picked are still shown.

export type ExplanationReason =
  | 'too_long'
  | 'unknown_citation'
  | 'canary'
  | 'prompt_echo'
  | 'number'
  | 'quotation'
  | 'markup'
  | 'address'
  | 'person'
  | 'claim'
  | 'time'
  | 'credential'
  | 'action'
  | 'language'
  | 'off_topic';

export interface ExplanationInput {
  explanation: string;
  language: AdvisorLanguage;
  /** The passages the answer shows: a [[id]] of one of them is dropped from the text; any other is rejected. */
  shownPassageIds: ReadonlySet<string>;
  index: ClauseIndex;
  canary: string;
  /** The system prompt as sent, to catch an explanation that echoes it. */
  instructions: string;
  toolNames: string[];
}

export type ExplanationVerdict = { text: string | null; reasons: [] } | { text: null; reasons: ExplanationReason[] };

export const EXPLANATION_MAX_LENGTH = 600;
export const EXPLANATION_MAX_SENTENCES = 4;

/** `(?<!letter)(a|b)(?!letter)` on lower-case text: \b knows only ASCII letters. */
const words$ = (alternatives: string[]): RegExp => new RegExp(`(?<![\\p{L}\\p{N}'])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}])`, 'u');

const CITATION = /\[\[([^\]]{0,120})\]\]/g;

// The one place an explanation may address the student: pointing at their own audit, record or plan.
const POINTER_EN =
  /(?:see|check|open|look at|consult|compare with)\s+(?:your|the)\s+(?:own\s+)?(?:degree audit|audit|record|transcript|study plan|plan|plans|roadmap)(?:\s+(?:page|screen|tab))?(?:\s+(?:for|to see)\s+(?:your|the)\s+(?:own\s+)?(?:numbers|figures|results?|case|situation|standing|status|credits|grades|progress))?/gu;
const POINTER_VI =
  /(?:xem|kiểm tra|đối chiếu|mở|tham khảo)\s+(?:lại\s+)?(?:bảng xét tốt nghiệp|kết quả xét tốt nghiệp|hồ sơ học tập|hồ sơ|bảng điểm|lộ trình học|lộ trình|kế hoạch học tập|kế hoạch)(?:\s+của\s+(?:bạn|em))?(?:\s+(?:để biết|để xem|về)\s+(?:số liệu|kết quả|tình trạng học tập|tình trạng học vụ|tình trạng|trường hợp|điểm|tín chỉ)(?:\s+của\s+(?:bạn|em))?)?/gu;

// Phrases that contain a listed word but are neither a verdict nor a person: "tiếng Anh" (English),
// "căn cứ" (on the basis of), "ổn định" (stable), "an toàn thông tin" (a faculty), "e.g.".
const HARMLESS = /(?<!\p{L})(?:tiếng anh|căn cứ|ổn định|an toàn thông tin|e\.g\.|i\.e\.|chứng chỉ|địa chỉ (?:văn phòng|phòng|trụ sở|liên hệ của phòng))(?!\p{L})/gu;

const NUMBER_WORDS = words$([
  'zero', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundreds?', 'thousands?', 'millions?',
  'dozens?', 'half', 'halves', 'quarters?', 'twice', 'thrice', 'triple', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'percent', 'per cent', 'percentage', 'minus', 'negative',
  'hai', 'ba', 'bốn', 'sáu', 'bảy', 'bẩy', 'tám', 'chín', 'mười', 'mươi', 'trăm', 'nghìn', 'ngàn', 'triệu', 'chục', 'rưỡi', 'nửa', 'lăm', 'mốt', 'phần trăm', 'gấp đôi', 'gấp ba',
]);
/** Typed without diacritics, only the number words that collide with nothing. */
const NUMBER_WORDS_PLAIN = words$(['hai', 'muoi', 'tram', 'nghin', 'chuc', 'ruoi', 'phan tram']);
const ROMAN = /(?<![\p{L}\p{N}])(?=[IVXLC]{2})C{0,3}(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})(?![\p{L}\p{N}])/u;

const QUOTATION = /["“”„«»「」『』‹›＂‘‚]|(?:^|[\s(])'(?=\p{L})/u;
/** Letters, combining marks, digits (reported as numbers), spaces and plain punctuation only. */
const MARKUP = /[^\p{L}\p{M}\p{N}\s.,;:!?()'’\-–—]/u;
/** A chat role label ("SYSTEM:", "assistant :") at the start of a sentence: text written to pass for another speaker. */
const ROLE_LABEL = /(?<![\p{L}\p{N}])(?:system|assistant|developer|user|tool|human|ai|hệ thống|trợ lý)\s*:/iu;
/**
 * The answer is in Vietnamese or English: a function word of another Latin-script language (French,
 * Spanish, Portuguese, Italian, German, Dutch, Indonesian), matched as written, means the explanation
 * is in a language the person, claim and time lists do not read. Words that are also English or
 * Vietnamese (die, do, as, con, la, le, tu, em, ton, para, mit…) are left out.
 */
const FOREIGN = words$([
  'est', 'es', 'au', 'sont', 'vous', 'nous', 'les', 'des', 'une', 'avec', 'pour', 'dans', 'pas', 'cette', 'peut', 'êtes', 'tes', 'votre', 'mais', 'aux', 'qui',
  'el', 'los', 'las', 'usted', 'ustedes', 'puede', 'puedes', 'está', 'eres', 'pero', 'del', 'una', 'tú', 'ya', 'también',
  'você', 'não', 'pode', 'são', 'uma', 'muito', 'já',
  'il', 'della', 'sei', 'puoi', 'anche', 'molto', 'perché', 'è',
  'der', 'das', 'und', 'ist', 'nicht', 'für', 'ein', 'eine', 'dich', 'dir', 'darfst', 'kannst', 'bist', 'sind', 'auch',
  'het', 'een', 'niet', 'je', 'jij', 'kunt',
  'anda', 'kamu', 'tidak', 'bisa', 'yang', 'sudah', 'boleh',
]);
const HOST = /(?<![\p{L}\p{N}])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?[.。．｡](?=[\p{L}\p{N}]))+\p{L}[\p{L}\p{N}-]*/gu;
const NOT_A_HOST = new Set(['e.g', 'i.e', 'tp.hcm', 'v.v', 'th.s', 'pgs.ts', 'gs.ts', 'a.m', 'p.m', 'đhqg-hcm']);
const DEFANGED_HOST = words$(['dot (?:com|vn|net|org|edu|io|me|site|top|xyz|info|app|link)', 'chấm (?:com|vn|net|org|edu)', 'cham (?:com|vn|net|org|edu)', 'www', 'https?', 'hxxps?']);

const PERSON_EN = words$([
  'i', "i'm", "i've", "i'll", "i'd", 'me', 'my', 'mine', 'myself', 'we', "we're", "we've", "we'll", 'us', 'our', 'ours', 'ourselves',
  'you', "you're", "you've", "you'll", "you'd", 'your', 'yours', 'yourself', 'yourselves', 'u', 'ur', 'ya', "y'all", 'yall',
  'he', 'she', 'him', 'her', 'hers', 'his', 'himself', 'herself',
]);
const PERSON_VI = words$([
  'tôi', 'tui', 'tớ', 'mình', 'chúng ta', 'chúng tôi', 'chúng mình', 'bạn', 'các bạn', 'em', 'các em', 'cậu', 'anh', 'chị', 'mày', 'bồ', 'ông', 'bà', 'cô ấy', 'nó',
]);
/** Typed without diacritics; "ban" is then "bạn" (with them it may be "Ban", a board). */
const PERSON_VI_PLAIN = words$(['ban', 'minh', 'toi', 'cau', 'em', 'anh', 'chi']);

const CLAIM_EN = words$([
  'yes', 'yeah', 'yep', 'yup', 'yea', 'nope', 'nah', 'sure', 'ok', 'okay', 'absolutely', 'definitely', 'certainly', 'of course', 'correct', 'indeed', 'exactly',
  'no', 'not', 'never', 'nobody', 'no one', 'none', 'nothing', 'neither', 'nor', 'without', 'cannot', 'can', 'could', 'may', 'might', 'must', 'shall',
  'should', 'will', 'would', 'need', 'needs', 'needed', 'have to', 'has to', 'had to', 'ought', 'able', 'unable', 'allow', 'allows', 'allowed', 'permit',
  'permits', 'permitted', 'permission', 'eligible', 'eligibility', 'ineligible', 'qualify', 'qualifies', 'qualified', 'cleared', 'approved', 'guarantee',
  'guaranteed', 'exempt', 'exempted', 'waive', 'waived', 'waiver', 'optional', 'skip', 'skipped', 'unnecessary', 'enforce', 'enforced', 'enforces',
  'satisfy', 'satisfies', 'satisfied', 'met', 'meets', 'fulfil', 'fulfill', 'fulfils', 'fulfills', 'fulfilled', 'completed', 'graduated', 'formality', 'suggestion', 'flexible', 'negotiable', 'loophole', 'technically', 'in practice', 'always', 'only', 'just', 'merely', 'congratulations',
  'congrats', 'go ahead', 'feel free', 'safe', 'fine', 'on track', 'confirm', 'confirmed', 'done', 'settled', 'good to go', 'all set', 'free to',
  // Whether a rule still holds is the school's to say, and an order to set the sources aside is an attack.
  'abolish', 'abolished', 'abolishes', 'repeal', 'repealed', 'revoke', 'revoked', 'rescind', 'rescinded', 'superseded', 'override', 'overridden', 'obsolete',
  'outdated', 'void', 'lifted', 'scrapped', 'ignore', 'disregard',
]);
const NOT_SUFFIX = /n't(?!\p{L})/u;
const CLAIM_VI = words$([
  'không', 'chẳng', 'chả', 'chưa', 'đừng', 'khỏi', 'chớ', 'được', 'đc', 'phải', 'cần', 'nên', 'có thể', 'có được', 'sẽ', 'tùy', 'tuỳ', 'đủ điều kiện', 'đủ đk',
  'thừa sức', 'chắc', 'chắc chắn', 'yên tâm', 'an toàn', 'ổn', 'xong', 'ok', 'oke', 'nhé', 'nha', 'nhá', 'nhỉ', 'ạ', 'đúng', 'chính xác', 'vâng', 'dạ', 'ừ',
  'cứ', 'thoải mái', 'tự do', 'luôn', 'chúc mừng', 'bỏ qua', 'được phép', 'cho phép', 'đồng ý', 'chỉ cần', 'chỉ được', 'chỉ là', 'chỉ mang tính', 'mang tính hình thức',
  'trên thực tế', 'thực tế thì', 'miễn là', 'bãi bỏ', 'hết hiệu lực', 'phớt lờ', 'bất kể',
]);
const CLAIM_VI_PLAIN = words$(['khong', 'duoc', 'dc', 'phai', 'can', 'nen', 'co the', 'se', 'du dieu kien', 'du dk', 'chua', 'roi', 'nhe', 'nha', 'dung']);
/** A bare "Có." or "Không" as the whole answer or its first word. */
const BARE_ANSWER = /^\s*(?:có|co|không|khong|rồi|roi)(?![\p{L}\p{N}])/u;

const TIME_EN = words$([
  'has been', 'have been', 'had been', 'was', 'were', 'did', 'now', 'today', 'tonight', 'tomorrow', 'yesterday', 'currently', 'current', 'already', 'yet',
  'soon', 'next', 'upcoming', 'coming', 'ago', 'so far', 'this term', 'this semester', 'this year', 'this record', 'this file', 'this student', 'right now',
  'at the moment', 'recently', 'lately', 'last term', 'last semester', 'last year', 'anymore', 'any more', 'no longer',
]);
const TIME_VI = words$([
  'đã', 'đang', 'vừa', 'sắp', 'rồi', 'hiện tại', 'hiện nay', 'bây giờ', 'giờ đây', 'lúc này', 'hôm nay', 'ngày mai', 'hôm qua', 'kỳ này', 'kì này', 'kỳ sau',
  'kì sau', 'kỳ tới', 'kỳ trước', 'năm nay', 'năm sau', 'năm tới', 'hồ sơ này', 'bảng điểm này', 'trường hợp này', 'gần đây', 'mới đây',
]);
const TIME_VI_PLAIN = words$(['da', 'dang', 'vua', 'ky nay', 'ki nay', 'ky sau', 'hien tai', 'bay gio']);

const CREDENTIAL = words$([
  'passwords?', 'passcode', 'pwd', 'pin', 'otp', 'log ?in', 'logon', 'sign ?in', 'sign-in', 'username', 'user name', 'credentials?', 'cookies?', 'session',
  'tokens?', 'verification', '2fa', 'student id', 'student number', 'id number', 'id card', 'date of birth', 'birthday', 'phone', 'e-?mail', 'home address',
  'zalo', 'facebook', 'fb', 'messenger', 'telegram', 'whatsapp', 'viber', 'gmail', 'google', 'inbox', 'dm', 'paste', 'reply with', 'type in', 'text me',
  'mật khẩu', 'mk', 'mã xác thực', 'mã otp', 'đăng nhập', 'tài khoản', 'mssv', 'mã số sinh viên', 'cccd', 'cmnd', 'căn cước', 'ngày sinh', 'số điện thoại',
  'sđt', 'sdt', 'địa chỉ email', 'địa chỉ nhà', 'nhắn tin', 'nhắn', 'dán', 'mat khau', 'dang nhap', 'tai khoan', 'so dien thoai',
]);
// A claim to have acted needs a subject (I, we: a person), a tense (was, đã: a time word) or "your":
// those checks read it. These idioms carry the claim without any of them.
const ACTION = words$(['locked in', 'taken care of', 'handled', 'went through', 'gone through', 'signed up', 'giúp bạn', 'hộ bạn', 'thay bạn', 'cho bạn']);

const SOURCE_WORDS = words$([
  'passages?', 'clauses?', 'articles?', 'regulations?', 'handbook', 'rules?', 'sections?', 'excerpts?', 'documents?', 'facts?', 'audit', 'record', 'transcript',
  'plan', 'office', 'điều khoản', 'khoản', 'điều', 'quy chế', 'quy định', 'sổ tay', 'trích', 'đoạn', 'mục', 'văn bản', 'bảng xét tốt nghiệp', 'hồ sơ', 'phòng',
]);

const SHINGLE = 8;

function shingles(text: string): Set<string> {
  const ws = words(text.replace(/\[\[[^\]]*\]\]|[a-z0-9-]+\/d\d+(\/[a-z0-9-]+)*/gi, ' '));
  const out = new Set<string>();
  for (let i = 0; i + SHINGLE <= ws.length; i++) out.add(ws.slice(i, i + SHINGLE).join(' '));
  return out;
}

/**
 * The parts of the prompt an explanation must never repeat: everything before the reference block,
 * without the fixed replies and the explanation rules, whose examples a faithful model may echo.
 */
function secretPart(instructions: string): string {
  let secret = instructions.split('<reference_clauses')[0].split(EXPLANATION_RULES).join(' ');
  for (const reply of Object.values(FIXED_REPLIES)) for (const text of Object.values(reply)) secret = secret.split(text).join(' ');
  return secret;
}

/** Sentences: at . ! ? ; and new lines. */
const sentences = (text: string): string[] => text.split(/[.!?;\n]+/).map((s) => s.trim()).filter((s) => /\p{L}/u.test(s));

export function guardExplanation(input: ExplanationInput): ExplanationVerdict {
  const reasons = new Set<ExplanationReason>();
  const raw = cleanInput(input.explanation).trim();
  if (input.canary && fold(raw).includes(fold(input.canary))) reasons.add('canary');

  // Citations of a shown passage are dropped (the passage is shown next to it); any other is rejected.
  for (const [, id] of raw.matchAll(CITATION)) if (!input.shownPassageIds.has(id.trim())) reasons.add('unknown_citation');
  const text = raw
    .replace(CITATION, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ +([.,;:!?])/g, '$1')
    .trim();
  if (!text && reasons.size === 0) return { text: null, reasons: [] };

  if (text.length > EXPLANATION_MAX_LENGTH || sentences(text).length > EXPLANATION_MAX_SENTENCES) reasons.add('too_long');

  const lowered = lower(text).replace(/’/g, "'");
  const folded = fold(text).replace(/’/g, "'");
  const secret = shingles(secretPart(input.instructions));
  if ([...shingles(text)].some((s) => secret.has(s)) || /prompt advisor-|internal marker/.test(folded) || input.toolNames.some((n) => folded.includes(n))) {
    reasons.add('prompt_echo');
  }

  // Numbers: any digit, number words, Roman and CJK numerals.
  if (/\p{N}/u.test(text) || /\d/.test(withSpelledNumbers(lower(withRomanNumerals(text)))) || ROMAN.test(text) || NUMBER_WORDS.test(lowered)) reasons.add('number');
  const plain = input.language === 'vi' && !/[̀-ͯ]|đ/i.test(text.normalize('NFD'));
  if (plain && NUMBER_WORDS_PLAIN.test(lowered)) reasons.add('number');

  if (QUOTATION.test(text)) reasons.add('quotation');
  if (MARKUP.test(text) || ROLE_LABEL.test(text)) reasons.add('markup');
  if ([...text.matchAll(HOST)].some(([h]) => !NOT_A_HOST.has(h.toLowerCase())) || DEFANGED_HOST.test(folded)) reasons.add('address');

  // What is left once the pointer and the harmless phrases are out is read for persons and claims.
  const rest = lowered.replace(POINTER_EN, ' ').replace(POINTER_VI, ' ').replace(HARMLESS, ' ');
  const restFolded = fold(rest);
  if (PERSON_EN.test(rest) || PERSON_VI.test(rest) || (plain && PERSON_VI_PLAIN.test(restFolded))) reasons.add('person');
  if (CLAIM_EN.test(rest) || NOT_SUFFIX.test(rest) || CLAIM_VI.test(rest) || BARE_ANSWER.test(rest) || (plain && CLAIM_VI_PLAIN.test(restFolded))) reasons.add('claim');
  if (TIME_EN.test(rest) || TIME_VI.test(rest) || (plain && TIME_VI_PLAIN.test(restFolded))) reasons.add('time');
  if (CREDENTIAL.test(rest) || CREDENTIAL.test(restFolded)) reasons.add('credential');
  if (ACTION.test(rest)) reasons.add('action');
  if (FOREIGN.test(lowered)) reasons.add('language');

  // Every sentence must be about the sources: a word the regulation or the handbook knows, or one
  // that names a source ("this clause", "the handbook passage").
  for (const sentence of sentences(rest)) {
    if (!/\p{L}{2}/u.test(sentence) || SOURCE_WORDS.test(sentence)) continue;
    if (input.index.search(sentence, 1).coverage === 0) reasons.add('off_topic');
  }

  if (reasons.size === 0) return { text, reasons: [] };
  return { text: null, reasons: [...reasons] };
}
