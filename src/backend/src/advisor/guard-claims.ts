import { stripMarks } from './retrieval/text.js';

// Claims the output guard reads clause by clause (ADR 0015): a verdict on the student's standing
// (hard rule 1), a rule said to be lifted or not to apply, and a verdict on a named person. Each
// function takes lower-case text with diacritics kept: folded Vietnamese merges "bạn" (you) with
// "bản" (document) and "cậu" (you) with "câu" (sentence).

const word = (alternatives: string): string => `(?<!\\p{L})(?:${alternatives})(?!\\p{L})`;
const re = (alternatives: string): RegExp => new RegExp(word(alternatives), 'u');

/** Sentences, then clauses: split at . ! ? and new lines (not "5.0"), then at , ; : and a dash, and before "but"/"nhưng". */
export function clausesOf(lowered: string): string[][] {
  return lowered
    .split(/(?<!\d)[.!?]+(?!\d)|\n+/)
    .map((s) =>
      s
        .split(/[,;:](?=\s|$)|\s[-–—]\s|(?<!\p{L})(?=(?:but|however|although|though|nhưng|tuy nhiên|song)(?!\p{L}))/u)
        .map((c) => c.trim())
        .filter(Boolean),
    )
    .filter((s) => s.length > 0);
}

// ── Second person ────────────────────────────────────────────────────────────
// "you", "your", "u", "ur"; Vietnamese "bạn", "em", "cậu", and in a reply typed without diacritics
// "ban", "cau". "b" and "e" (teen code) only right before a verdict word.
const YOU_EN = "you|your|yours|you're|youre|you’re|u|ur|yourself";
const YOU_VI = 'bạn|em|cậu|các bạn|mày';
const YOU_VI_PLAIN = 'ban|cau';
const YOU_SHORT = /(?<!\p{L})[be]\s+(đủ|đã|được|chưa|không|có thể|sẽ|đc|dc|du|da|duoc)(?!\p{L})/u;

export function addressesStudent(clause: string, plain: boolean): boolean {
  return re(YOU_EN).test(clause) || re(YOU_VI).test(clause) || (plain && re(YOU_VI_PLAIN).test(clause)) || YOU_SHORT.test(clause);
}

// ── Verdicts on standing ─────────────────────────────────────────────────────
// What the rule engine decides (hard rule 1): graduation, eligibility, meeting requirements, being
// allowed to register for or take a course, warnings and dismissal. Read on folded text, so "đủ đk"
// and "du dk" match alike. A requirement ("you must retake it", "bạn cần tích lũy…") is not a verdict.
const VERDICT_EN = [
  /(?:(?<!\p{L})|(?=['’]))(?:(?:are|is|'re|’re|r|am|will be|would be|should be|were)\s+(?:not\s+|now\s+|already\s+|fully\s+|still\s+|definitely\s+|officially\s+|totally\s+|all\s+)*(?:eligible|qualified|cleared|approved|exempt|safe|set to graduate|all set|on track|good to go|allowed|permitted|free to|fine to|ok to|okay to|on (?:academic )?probation|under (?:an )?(?:academic )?warning|expelled|dismissed|suspended|in good standing|graduat))/u,
  /(?:(?<!\p{L})|(?=['’]))(?:(?:can|cannot|can't|can’t|could|may|may not|will|will not|won't|won’t|should be able to|are able to|get to|are going to|'ll|’ll)\s+(?:not\s+|still\s+|now\s+|definitely\s+|already\s+|safely\s+|officially\s+|totally\s+)*(?:graduate|skip|go ahead|proceed|move on|get your degree|(?:register|take|enrol|enroll)\s+(?:for\s+|in\s+)?(?:[a-z]{2,4}\s?\d{3,5}|it(?!\p{L})|this|that|the course|the class|more|over|above|beyond|\d)))/u,
  /(?:(?<!\p{L})|(?=['’]))(?:(?:have|has|'ve|’ve|had)\s+(?:not\s+|now\s+|already\s+|successfully\s+|officially\s+)*(?:graduated|completed (?:your|the|all)|finished (?:your|the|all)|met|satisfied|fulfilled|passed all|qualified))/u,
  /(?:(?<!\p{L})|(?=['’]))(?:(?:meet|meets|satisfy|satisfies|fulfil|fulfill|fulfils|fulfills)\s+(?:all\s+)?(?:of\s+)?(?:the\s+|your\s+)?(?:graduation|requirements?|prerequisites?|conditions?|degree))/u,
  /(?:(?<!\p{L})|(?=['’]))(?:your\s+(?:graduation|degree|registration|enrol?ment|status|standing|record|request)\s+(?:\S+\s+){0,3}?(?:is|are|was|will be|has been|looks|seems)?\s*(?:approved|complete|completed|confirmed|done|fine|ok|okay|clear|cleared|settled|guaranteed|waived|safe|set|go through|went through))/u,
  /(?:(?<!\p{L})|(?=['’]))(?:(?:go ahead|register freely|feel free to (?:register|take)|fine for you|ok for you|okay for you|safe for you|for you personally|in your case|congratulations|congrats|will go through|went through))/u,
];
const VERDICT_VI = [
  /(?:(?<!\p{L})|(?=['’]))(?:(?:du|khong du|chua du)\s+(?:dieu kien|dk|đk))/u,
  /(?:(?<!\p{L})|(?=['’]))(?:(?:da|duoc|se|co the|khong the|chua the|van|chac chan|hoan toan|chua|roi)\s+(?:\S+\s+){0,2}?(?:tot nghiep|ra truong))/u,
  /(?:(?<!\p{L})|(?=['’]))(?:tot nghiep\s+(?:roi|duoc|nhe|nha))/u,
  /(?:(?<!\p{L})|(?=['’]))(?:(?:da|duoc|se|chua|khong|van|deu)\s+(?:dap ung|hoan thanh het|hoan thanh du|hoan thanh tat ca))/u,
  /(?:(?<!\p{L})|(?=['’]))(?:(?:bi|khong bi|se bi|se khong bi|chua bi|dang bi|van bi|da bi)\s+(?:\S+\s+){0,1}?(?:canh bao|buoc thoi hoc|dinh chi|xu ly hoc vu|ky luat|duoi hoc|thoi hoc))/u,
  /(?:(?<!\p{L})|(?=['’]))(?:(?:an toan|yen tam|khong co nguy co|khong lo))/u,
  /(?:(?<!\p{L})|(?=['’]))(?:(?:duoc|khong duoc|co the|khong the|duoc phep|hoan toan co the|cu|cu viec|duoc mien)\s+(?:\S+\s+){0,2}?(?:dang ky|hoc|lay|bo qua|vuot|mien)\s+(?:mon\s+|hoc phan\s+)?[a-z]{2,4}\s?\d{3,5})/u,
  /(?:(?<!\p{L})|(?=['’]))(?:(?:cu|cu viec|cu the)\s+(?:dang ky|hoc|lay))/u,
  /(?:(?<!\p{L})|(?=['’]))(?:(?:dang ky|hoc)\s+(?:thang|thoai mai|tu do|luon))/u,
];

// The verdict patterns of the first guard, kept: they also read third-person subjects ("the student has
// satisfied…"), so a clause that matches one needs no second-person word.
const STATUS_EN = new RegExp(
  [
    /\b(you|this student|the student)\s+(are|'re|is|are not|aren't|is not|are now|will be|would be|is therefore|are therefore)\s+(not\s+|now\s+|already\s+|fully\s+)*(eligible|qualified|on (academic )?probation|under (an )?academic warning|allowed to (graduate|register|take|enrol))/.source,
    /\byou\s+(can|cannot|can't|could|may|may not|will|will not|won't|should be able to)\s+(not\s+|still\s+|now\s+)*graduate\b/.source,
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
// Hedges ("whether", "cannot confirm", "hay không") make a clause no verdict. A condition makes the
// clause it ends a rule, not a verdict, only if it is about studies ("If you complete all
// requirements, you can graduate"); "If you want, you are eligible" is still a verdict.
const HEDGE = /(?<!\p{L})(?:whether|cannot confirm|can't confirm|can’t confirm|cannot check|can't check|unable to confirm|not able to confirm|cannot tell|can't tell|cannot say|khong the xac nhan|chua the xac nhan|khong xac nhan duoc|chua xac nhan duoc|khong the kiem tra|hay khong|hay chua|lieu|depends on|tuy thuoc)(?!\p{L})/u;
const CONDITION = /(?<!\p{L})(?:if|when|once|unless|provided|as long as|before|after|until|neu|khi|mot khi|tru khi|truoc khi|sau khi|cho den khi)(?!\p{L})/u;
/** A requirement is no verdict: "you must retake it", "bạn cần tích lũy đủ tín chỉ". Read with diacritics: folded "cần" is "can". */
const REQUIREMENT = /(?<!\p{L})(?:cần|phải|must|need to|needs to|have to|has to|required to)(?!\p{L})/u;
/** A refutation reports what no source says: "no clause says…", "không có câu nào nói…". */
export const REFUTATION = /(?<!\p{L})(?:no clause|none of|not find|cannot find|can't find|could not find|found no|does not say|doesn't say|do not say|nothing in|there is no clause|khong co (?:cau|dieu|khoan|quy dinh|diem) nao|khong tim thay|khong noi|khong ghi|khong co quy dinh)(?!\p{L})/u;
const STUDY = /(?<!\p{L})(?:programmes?|programs?|chuong trinh|nganh|credits?|tin chi|tc|grades?|diem|gpa|courses?|hoc phan|mon|requirements?|dieu kien|complete|completes|completed|hoan thanh|pass|passes|passed|dat|tich luy|accumulat\w*|meet|meets|dap ung|terms?|hoc ky|submit|nop|approv\w*|chap thuan|dong y|register\w*|dang ky|rule engine|audit|kiem tra|confirm\w*|xac nhan)(?!\p{L})/u;

export type Polarity = 'positive' | 'negative';
export interface StandingClaim {
  graduation: boolean;
  polarity: Polarity;
}

const NEGATIVE = /(?<!\p{L})(?:not|n't|n’t|cannot|can't|won't|no longer|never|chua|khong|chang)(?!\p{L})/u;
/** Only these verdicts can rest on the engine's result (the degree audit's graduation status). */
const GRADUATION = /(?<!\p{L})(?:graduat\w*|degree|diploma|tot nghiep|ra truong)(?!\p{L})/u;

/** The verdicts on the student's own standing in an answer, clause by clause. `plain`: the answer has no diacritics. */
export function standingClaims(lowered: string, plain: boolean): StandingClaim[] {
  const claims: StandingClaim[] = [];
  for (const sentence of clausesOf(lowered)) {
    let conditional = false;
    for (const clause of sentence) {
      const folded = stripMarks(clause);
      const isCondition = CONDITION.test(folded) && STUDY.test(folded.split(CONDITION).slice(1).join(' '));
      if (isCondition) conditional = true;
      if (conditional || HEDGE.test(folded) || REQUIREMENT.test(clause) || REFUTATION.test(folded)) continue;
      const legacy = STATUS_EN.test(folded) || STATUS_VI.test(folded);
      if (!legacy && !(addressesStudent(clause, plain) && [...VERDICT_EN, ...VERDICT_VI].some((p) => p.test(folded)))) continue;
      claims.push({ graduation: GRADUATION.test(folded), polarity: NEGATIVE.test(folded) ? 'negative' : 'positive' });
    }
  }
  return claims;
}

// ── A named person's standing ───────────────────────────────────────────────
// The advisor sees only the signed-in student's record, so a verdict on anyone named is invented.
// The commonest surnames only: Lý, Mai, Cao, Châu… also start course and place names (Vật Lý Đại Cương, Châu Á).
const SURNAMES = 'Nguyễn|Trần|Lê|Phạm|Hoàng|Huỳnh|Phan|Vũ|Võ|Đặng|Bùi|Đỗ|Hồ|Ngô|Dương|Đinh|Trương|Đoàn';
const NAME = new RegExp(`(?<!\\p{L})(?!Hồ Chí Minh)(?:${SURNAMES})(?:\\s+\\p{Lu}\\p{Ll}*){1,3}(?!\\p{L})`, 'gu');
const STANDING_WORD = /(?<!\p{L})(?:tot nghiep|canh bao|buoc thoi hoc|thoi hoc|dinh chi|ky luat|du dieu kien|hoc bong|eligible|graduat\w*|probation|warning|expelled|dismissed|suspended|scholarship|gpa|diem trung binh)(?!\p{L})/u;

/** Whether an answer states the standing of a person it names ("sinh viên Trần Thị Xê đã bị buộc thôi học"). */
export function namedStandingClaim(original: string, lowered: string): boolean {
  const names = [...original.matchAll(NAME)].map((m) => m[0].toLowerCase());
  if (!names.length) return false;
  return clausesOf(lowered).some((sentence) => {
    const text = sentence.join(' , ');
    return names.some((n) => text.includes(n)) && STANDING_WORD.test(stripMarks(text));
  });
}

// ── A rule said to be lifted or not to apply ──────────────────────────────────
// Residual risk R2 had no number to check: "there is no credit cap", "the cap was lifted", "không cần
// học lại". A claim that a cap, a prerequisite, an approval or a graduation requirement does not
// exist or does not apply is replaced, unless a clause the answer cites says so in the same words.
const ABOLISHED = [
  /(?<!\p{L})no\s+(?:credit\s+)?(?:cap|limit|maximum|ceiling|prerequisites?|approval|petition|restrictions?)(?!\p{L})/u,
  /(?<!\p{L})(?:unlimited|uncapped|without (?:any |a )?(?:limit|cap|approval|prerequisites?|restrictions?|petition|permission))(?!\p{L})/u,
  /(?<!\p{L})(?:cap|limit|maximum|prerequisites?|requirements?|restrictions?|rule)\s+(?:\S+\s+){0,3}?(?:is|are|was|were|has been|have been|got|gets|is now|are now)?\s*(?:lifted|abolished|removed|waived|suspended|scrapped|cancell?ed|canceled|not enforced|not required|void|no longer appl\w*|does not apply|do not apply|don't apply|doesn't apply|not apply)(?!\p{L})/u,
  /(?<!\p{L})(?:lifted|abolished|removed|waived|scrapped|suspended)\s+(?:the\s+|your\s+)?(?:credit\s+)?(?:cap|limit|prerequisites?|requirements?)(?!\p{L})/u,
  /(?<!\p{L})(?:do|does|did)\s*(?:not|n't|n’t)\s+(?:apply|count)(?!\p{L})/u,
  /(?<!\p{L})(?:not enforced|no longer applies|as many (?:credits|courses) as|more (?:credits )?than (?:usual|allowed|the cap|the maximum|the limit)|above the cap is fine|exceed (?:the )?(?:cap|maximum|limit) (?:freely|without))(?!\p{L})/u,
  /(?<!\p{L})(?:no|don't|do not|doesn't|does not|never)\s+(?:need|require)s?\s+(?:an?\s+|any\s+|the\s+)?(?:approval|permission|petition|prerequisites?|request)(?!\p{L})/u,
  /(?<!\p{L})no\s+(?:approval|permission|petition|request)\s+(?:is\s+)?(?:needed|required)(?!\p{L})/u,
  /(?<!\p{L})(?:skip|bypass|ignore)\s+(?:the\s+|your\s+)?(?:prerequisites?|cap|limit|requirements?)(?!\p{L})/u,
  /(?<!\p{L})khong\s+(?:co\s+|con\s+)?(?:gioi han|tran|han che|toi da)(?!\p{L})/u,
  /(?<!\p{L})(?:bo|bai bo|huy bo|mien|xoa bo|go bo|bo qua)\s+(?:\S+\s+){0,2}?(?:tran|gioi han|tien quyet|dieu kien)(?!\p{L})/u,
  /(?<!\p{L})(?:tran|gioi han|tien quyet|dieu kien)\s+(?:\S+\s+){0,3}?(?:da duoc|duoc|da bi|bi)\s+(?:bo|bai bo|huy bo|mien|go bo|xoa bo|nang)(?!\p{L})/u,
  /(?<!\p{L})khong\s+(?:can|phai|bat buoc)\s+(?:phai\s+)?(?:hoc\s+)?(?:tien quyet|hoc phan tien quyet|hoc lai|xin phep|lam don|nop don|phe duyet|chap thuan|dong y|don)(?!\p{L})/u,
  /(?<!\p{L})(?:tien quyet|dieu kien|quy dinh|tran)\s+(?:\S+\s+){0,3}?khong\s+(?:ap dung|con hieu luc|bat buoc)(?!\p{L})/u,
  /(?<!\p{L})(?:vo han|tuy y|thoai mai)\s+(?:\S+\s+){0,2}?(?:tin chi|dang ky)(?!\p{L})/u,
  /(?<!\p{L})(?:dang ky|hoc)\s+(?:\S+\s+){0,2}?(?:vo han|tuy y|khong gioi han)(?!\p{L})/u,
];

/** The phrases of an answer that say a rule is lifted or does not apply, if no cited clause says the same. */
export function abolishedRule(lowered: string, citedFolded: string[]): boolean {
  return clausesOf(lowered).some((sentence) => {
    const folded = stripMarks(sentence.join(' , '));
    if (REFUTATION.test(folded)) return false;
    return ABOLISHED.some((p) => {
      const m = p.exec(folded);
      return m !== null && !citedFolded.some((c) => c.includes(m[0].trim()));
    });
  });
}
