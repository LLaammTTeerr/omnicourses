// Text normalisation for the advisor's retrieval, topic gate and output guard (ADR 0015).
// Deterministic and dependency-free: the same functions read a clause, a question and a reply.

// Letters from other scripts that look like Latin ones, folded so "іgnore" (Cyrillic і) reads as
// "ignore". Only the gate and the guard match on folded text; what reaches the model is not folded.
const HOMOGLYPHS: Record<string, string> = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', һ: 'h', ӏ: 'l', ɡ: 'g',
  А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X', І: 'I', Ј: 'J', Ѕ: 'S',
  α: 'a', ο: 'o', ρ: 'p', ν: 'v', ι: 'i', κ: 'k', τ: 't', υ: 'u', χ: 'x', Α: 'A', Β: 'B', Ε: 'E', Ι: 'I', Κ: 'K', Μ: 'M',
  Ν: 'N', Ο: 'O', Ρ: 'P', Τ: 'T', Χ: 'X', Υ: 'Y', Ζ: 'Z',
  // Latin letters NFKC keeps apart: IPA and small capitals ("pɑssword", "ᴘᴀssword").
  ɑ: 'a', ɐ: 'a', ɒ: 'a', ɛ: 'e', ɔ: 'o', ı: 'i', ɩ: 'i', ɪ: 'i', ʋ: 'v', ʏ: 'y', ѵ: 'v', ԛ: 'q', ԝ: 'w',
  ᴀ: 'a', ʙ: 'b', ᴄ: 'c', ᴅ: 'd', ᴇ: 'e', ꜰ: 'f', ɢ: 'g', ʜ: 'h', ᴊ: 'j', ᴋ: 'k', ʟ: 'l', ᴍ: 'm', ɴ: 'n', ᴏ: 'o', ᴘ: 'p',
  ʀ: 'r', ꜱ: 's', ᴛ: 't', ᴜ: 'u', ᴠ: 'v', ᴡ: 'w', ᴢ: 'z',
};
const HOMOGLYPH_PATTERN = new RegExp(`[${Object.keys(HOMOGLYPHS).join('')}]`, 'gu');

/** A decimal digit of any script as its ASCII digit: "٣٠" is "30". Each script's digits are ten in a row. */
function asciiDigit(digit: string): string {
  let start = digit.codePointAt(0)!;
  while (/\p{Nd}/u.test(String.fromCodePoint(start - 1))) start--;
  return String(((digit.codePointAt(0)! - start) % 10 + 10) % 10);
}

/**
 * Cleans text a student typed before anything reads it: NFKC (full-width letters become ASCII,
 * decomposed Vietnamese is composed), digits of every script as ASCII digits, and no invisible
 * format characters (zero-width, bidi overrides, tag characters). Sent to the model as cleaned;
 * meaning is unchanged.
 */
export function cleanInput(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/(?![0-9])\p{Nd}/gu, asciiDigit)
    .replace(/\p{Cf}/gu, '');
}

/** Lower case, cleaned, homoglyphs to Latin; Vietnamese diacritics kept. */
export function lower(text: string): string {
  return cleanInput(text)
    .replace(HOMOGLYPH_PATTERN, (c) => HOMOGLYPHS[c])
    .toLowerCase();
}

export const stripMarks = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gu, 'd').normalize('NFC');

/** Folds text for matching: cleaned, homoglyphs to Latin, no diacritics, đ → d, lower case. */
export function fold(text: string): string {
  return stripMarks(lower(text));
}

/** A word as written (lower case, diacritics kept) and folded. */
export interface Token {
  raw: string;
  folded: string;
  /** Tokens from one synonym replacement share a group; neighbours from different groups are not paired. */
  group?: number;
}

/** The words of a text: runs of letters, and numbers (a decimal comma or point stays inside: 5,0). */
export function tokens(text: string): Token[] {
  return (lower(text).match(/\p{L}+|\d+(?:[.,]\d+)?/gu) ?? []).map((raw) => ({ raw, folded: stripMarks(raw) })).filter((t) => /^[a-z0-9.,]+$/.test(t.folded));
}

/** Folded words of a text. */
export function words(text: string): string[] {
  return tokens(text).map((t) => t.folded);
}

// Function words that carry no topic. Without them an off-topic Vietnamese question shares "là",
// "được", "không", "có", "của" with every clause. Folding merges syllables (tôi and tối are both
// "toi"), so a word written with diacritics is checked against the Vietnamese list as written, and
// only a word typed without diacritics against the folded list.
const VI_STOPWORDS = new Set(
  (
    'à ạ ai anh bị bởi cả các cái cần càng cho chưa chúng có của cũng đã để đến đều được gì hả hay hoặc khi không là mà mình một nào này nếu nghe nhé những như nó nữa ở ơi ông qua rằng rất rồi sao sẽ tại tao thì theo thế trong vì với vậy xin ' +
    'em tôi tớ bạn người cậu giùm giúp hỏi biết vâng về sau trên vào nhỉ đi chứ đâu thôi lắm mấy bao nhiêu muốn làm phải còn ra sẽ'
  ).split(/\s+/),
);
const EN_STOPWORDS =
  'a an the is are was were be been being am do does did doing have has had having i me my mine we our you your he she it its they them their this that these those ' +
  'what which who whom whose when where why how can could would should shall will may might must of to in on at by for with about from into over under than then there here ' +
  'and or but if so not no yes please tell explain say give get let know want need just also any some all each every both much many more most very too really ' +
  'up out as like okay ok hi hello thanks thank per happen happens happened mean means does doing thing things something way';
const FOLDED_STOPWORDS = new Set([...EN_STOPWORDS.split(/\s+/), ...[...VI_STOPWORDS].map(stripMarks)]);

/** Whether a word carries no topic. */
export function isStopword(token: Token): boolean {
  return token.raw !== token.folded ? VI_STOPWORDS.has(token.raw) : FOLDED_STOPWORDS.has(token.folded);
}

const isContent = (t: Token): boolean => !isStopword(t) && (t.folded.length > 1 || /\d/.test(t.folded));

/** The folded words worth matching: stopwords and one-letter words dropped. */
export function contentWords(text: string): string[] {
  return tokens(text).filter(isContent).map((t) => t.folded);
}

/** One index term: a word, or a pair of neighbours joined by `_`. */
export interface Term {
  term: string;
  pair: boolean;
  /** For a pair: both words are stopwords, so it counts only where the index knows it (tối đa typed "toi da"). */
  weak: boolean;
}

const accented = (t: Token): boolean => t.raw !== t.folded;
// A word written with diacritics is also indexed as written, under this prefix. A question written
// with diacritics matches on that form, so "thì" never matches "thi" and "mùa" never matches "mua";
// a question typed without diacritics matches the folded form of every word.
const RAW = '~';
const key = (ts: Token[], asWritten: boolean): string => (asWritten ? RAW + ts.map((t) => t.raw).join('_') : ts.map((t) => t.folded).join('_'));

/**
 * Terms of a token sequence: its content words, plus each pair of neighbours ("hoc_lai", "tin_chi",
 * "toi_da"). Vietnamese words are mostly two syllables, so the pairs carry the meaning that single
 * folded syllables lose. Neighbours from two different synonym replacements, or from a replacement
 * and the question's own words, are not paired: "how many credits" gives tối đa and tín chỉ, never
 * "da_tin". `index` gives every form of each term; `query` the one form the question was written in.
 */
export function termsOf(sequence: Token[], mode: 'index' | 'query'): Term[] {
  const terms: Term[] = [];
  const add = (ts: Token[], pair: boolean, weak: boolean) => {
    const written = ts.some(accented);
    if (mode === 'index') {
      terms.push({ term: key(ts, false), pair, weak });
      if (written) terms.push({ term: key(ts, true), pair, weak });
    } else {
      terms.push({ term: key(ts, written), pair, weak });
    }
  };
  for (const t of sequence) if (isContent(t)) add([t], false, false);
  for (let i = 0; i + 1 < sequence.length; i++) {
    const [a, b] = [sequence[i], sequence[i + 1]];
    if (a.group !== b.group) continue;
    add([a, b], true, !isContent(a) && !isContent(b));
  }
  return terms;
}
