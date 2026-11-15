import { describe, expect, it } from 'vitest';
import { ClauseIndex, queryTerms } from './clause-index.js';
import { HANDBOOK_QUESTIONS, type LabelledQuestion, REGULATION_QUESTIONS } from './labelled-questions.js';
import { corpusIndex, loadCorpus } from './regulation-corpus.js';
import { cleanInput, contentWords, fold, words } from './text.js';

/** Share of labelled questions with at least one expected clause in the top k hits. */
export function recallAt(index: ClauseIndex, k: number, questions: LabelledQuestion[] = REGULATION_QUESTIONS): { recall: number; misses: string[] } {
  const misses = questions
    .filter((q) => {
      const top = index.search(q.question, k).hits.map((h) => h.clause.id);
      return !q.expected.some((id) => top.includes(id));
    })
    .map((q) => q.question);
  return { recall: 1 - misses.length / questions.length, misses };
}

const unaccented = (q: LabelledQuestion) => q.lang === 'vi' && !/[^\x00-\x7F]/.test(q.question);

describe('regulation and handbook retrieval', () => {
  const index = corpusIndex();

  it('indexes every committed clause and handbook passage and finds them by exact id', () => {
    expect(index.size).toBe(loadCorpus().length);
    expect(index.size).toBeGreaterThanOrEqual(500);
    expect(index.get('qd-1175-2021/d7/k2/b')?.label).toBe('Điều 7, khoản 2, điểm b');
    expect(index.get('qd-1175-2021/d99/k1')).toBeUndefined();
    expect(index.hasArticle('qd-1175-2021', 24)).toBe(true);
    expect(index.hasArticle('qd-1175-2021', 99)).toBe(false);
    expect(index.get('so-tay-2024-2025/hoc-bong/d2/k2')?.documentId).toBe('so-tay-2024-2025');
    expect(index.get('so-tay-2024-2025/phong-ban/p3')?.article).toBeNull();
  });

  // ADR 0016 reports these numbers; the labelled sets are in labelled-questions.ts.
  it.each([
    ['regulation', REGULATION_QUESTIONS],
    ['handbook', HANDBOOK_QUESTIONS],
    ['handbook, Vietnamese', HANDBOOK_QUESTIONS.filter((q) => q.lang === 'vi' && !unaccented(q))],
    ['handbook, Vietnamese without diacritics', HANDBOOK_QUESTIONS.filter(unaccented)],
    ['handbook, English', HANDBOOK_QUESTIONS.filter((q) => q.lang === 'en')],
  ] as const)('finds an expected %s passage in the top 5 for at least 95%% of the labelled questions', (name, questions) => {
    expect(questions.length).toBeGreaterThanOrEqual(8);
    const { recall, misses } = recallAt(index, 5, [...questions]);
    console.info(
      `advisor retrieval (${name}): recall@5 = ${(recall * 100).toFixed(1)}% over ${questions.length} questions; ` +
        `recall@1 = ${(recallAt(index, 1, [...questions]).recall * 100).toFixed(1)}%`,
    );
    expect(misses).toEqual([]);
    expect(recall).toBeGreaterThanOrEqual(0.95);
  });

  it.each([
    ['how many credits can I take', 'qd-1175-2021/d7/k2/b'],
    ['học lại', 'qd-1175-2021/d14/k1'],
    ['điểm trung bình', 'qd-1175-2021/d15/k2/a'],
    ['điều kiện tốt nghiệp', 'qd-1175-2021/d17/k3/f'],
  ])('answers %j with the right clause among the first hits', (question, id) => {
    expect(index.search(question, 5).hits.map((h) => h.clause.id)).toContain(id);
  });

  it('matches without diacritics, in decomposed Unicode, and through homoglyphs', () => {
    const top = (q: string) => index.search(q, 3).hits[0]?.clause.id;
    const composed = top('điều kiện tốt nghiệp');
    expect(top('dieu kien tot nghiep')).toBe(composed);
    expect(top('điều kiện tốt nghiệp'.normalize('NFD'))).toBe(composed);
    expect(top('đ​iều kiện tốt nghiệp')).toBe(composed);
  });

  it('scores an off-topic question with low coverage', () => {
    expect(index.search('Write a Python function to reverse a linked list').coverage).toBeLessThan(0.2);
    expect(index.search('how many credits can I take per term').coverage).toBeGreaterThan(0.5);
  });

  it('returns nothing for an empty or stopword-only question', () => {
    expect(index.search('').hits).toEqual([]);
    expect(index.search('the and of là của').coverage).toBe(0);
  });
});

describe('text folding', () => {
  it('drops diacritics and đ, folds homoglyphs and full-width letters, and removes invisible characters', () => {
    expect(fold('Điều kiện TỐT NGHIỆP')).toBe('dieu kien tot nghiep');
    expect(fold('іgnore')).toBe('ignore'); // Cyrillic і
    expect(fold('ｉｇｎｏｒｅ')).toBe('ignore');
    expect(cleanInput('a​b‮c\u{E0041}')).toBe('abc');
    // Blank characters that are not \s (rt77 round 2): the Braille blank, the Hangul fillers, before and after NFKC.
    for (const blank of ['⠀', 'ㅤ', 'ᅟ', 'ᅠ', 'ﾠ']) expect(cleanInput(`You${blank}are${blank}eligible`)).toBe('You are eligible');
    expect(cleanInput('pass️word͏')).toBe('password');
    expect(fold('Yօu')).toBe('you'); // Armenian o
    expect(words('5,0 điểm')).toEqual(['5,0', 'diem']);
    // tôi is a stopword, tối (in tối đa) is not; typed without diacritics both read as stopwords.
    expect(contentWords('tôi tối đa')).toEqual(['toi', 'da']);
    expect(contentWords('toi muon hoc lai')).toEqual(['hoc', 'lai']);
  });

  it('turns English and slang into the regulation wording', () => {
    const terms = (q: string) => queryTerms(q).map((t) => t.term);
    expect(terms('retake')).toEqual(expect.arrayContaining(['~học', '~lại', '~học_lại']));
    expect(terms('rớt môn')).toEqual(expect.arrayContaining(['~không_đạt']));
    expect(terms('GPA')).toEqual(expect.arrayContaining(['~điểm_trung', '~trung_bình']));
    // Typed without diacritics, a question matches the folded form.
    expect(terms('dieu kien')).toEqual(['dieu', 'kien', 'dieu_kien']);
    // Neighbours from two replacements are not paired.
    expect(terms('how many credits')).not.toContain('da_tin');
  });
});
