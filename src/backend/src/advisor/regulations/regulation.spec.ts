import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type Hunk,
  type RegulationDocument,
  type RegulationOverride,
  type RegulationSource,
  diffWords,
  extractRegulation,
  idFromLabel,
  joinWrapped,
  pageLines,
  parseLabel,
  renderMarkdown,
  renderPlainText,
  sourceWords,
  words,
} from './regulation.js';
import { jsonOf, readInputs, REGULATIONS_DIR, regulationIds } from './regulation-files.js';

/** One line per hunk, so a failure prints a readable diff report. */
const report = (hunks: Hunk[]): string[] =>
  hunks.map((hunk) => `- ${hunk.removed.join(' ') || '(nothing)'}\n+ ${hunk.added.join(' ') || '(nothing)'}`);

const MARKER = /^(\d+\.|[a-zđ]\)) /u;

describe.each(regulationIds())('regulation %s', (id) => {
  const { source, pdftotext, overrides } = readInputs(id);
  const committedJson = readFileSync(join(REGULATIONS_DIR, `${id}.json`), 'utf8');
  const document = JSON.parse(committedJson) as RegulationDocument;

  it('is exactly what the extraction script writes from the committed sources', () => {
    expect(committedJson).toBe(jsonOf(extractRegulation(source, pdftotext, overrides)));
  });

  it('has a Markdown version generated from the JSON', () => {
    expect(readFileSync(join(REGULATIONS_DIR, `${id}.md`), 'utf8')).toBe(renderMarkdown(document));
  });

  it('keeps every source word in order, except the residue its overrides declare', () => {
    // Layout overrides (tables) must not change a word; text overrides are the only allowed residue.
    const declared: Hunk[] = [];
    for (const override of overrides) {
      const hunks = diffWords(words(override.source.join('\n')), words(override.replacement.join('\n')));
      if (override.kind === 'layout') expect(report(hunks), `layout override on page ${override.page}`).toEqual([]);
      else expect(hunks.length, `text override on page ${override.page} changes nothing`).toBeGreaterThan(0);
      declared.push(...hunks);
    }
    const residue = diffWords(sourceWords(pdftotext), words(renderPlainText(document)));
    expect(report(residue)).toEqual(report(declared));
  });

  it('has unique ids, each the one its label names', () => {
    const ids = document.clauses.map((clause) => clause.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const clause of document.clauses) {
      const label = parseLabel(clause.label);
      expect(label, clause.label).not.toBeNull();
      expect(idFromLabel(id, label!)).toBe(clause.id);
      expect(label!.article).toBe(clause.article.number);
      expect(label!.khoan).toBe(clause.khoan);
      expect(label!.diem).toBe(clause.diem);
      expect(clause.level).toBe(clause.diem !== null ? 'diem' : clause.khoan !== null ? 'khoan' : 'article');
    }
  });

  it('has every Điều from 1 to the last, in order, each with a title and a chapter', () => {
    const articles = [...new Set(document.clauses.map((clause) => clause.article.number))];
    expect(articles).toEqual(articles.map((_, index) => index + 1));
    for (const clause of document.clauses) {
      expect(clause.article.title, clause.id).not.toBe('');
      expect(clause.chapter.title, clause.id).not.toBe('');
    }
  });

  it('opens one clause for every source line led by a khoản or điểm marker', () => {
    const sourceMarkers = pageLines(pdftotext)
      .map((line) => line.raw.trim())
      .filter((line) => MARKER.test(line))
      .map((line) => MARKER.exec(line)![1]);
    const clauseMarkers = document.clauses.filter((clause) => clause.level !== 'article').map((clause) => MARKER.exec(clause.text)?.[1]);
    expect(clauseMarkers).toEqual(sourceMarkers);
  });

  it('gives each clause clean text and real pages', () => {
    for (const clause of document.clauses) {
      expect(clause.text, clause.id).toBe(clause.text.trim());
      expect(clause.text, clause.id).not.toMatch(/ {2}|\n\n/u);
      // Private-use characters are symbol-font glyphs that only an override can read.
      expect(clause.text, clause.id).not.toMatch(/[-]/u);
      expect(clause.pages.length, clause.id).toBeGreaterThan(0);
      expect(clause.pages, clause.id).toEqual([...clause.pages].sort((a, b) => a - b));
      for (const page of clause.pages) expect(page).toBeGreaterThanOrEqual(1);
      for (const page of clause.pages) expect(page).toBeLessThanOrEqual(source.pdf.pages);
    }
  });
});

describe('qd-1175-2021', () => {
  const document = JSON.parse(readFileSync(join(REGULATIONS_DIR, 'qd-1175-2021.json'), 'utf8')) as RegulationDocument;
  const clause = (id: string) => document.clauses.find((each) => each.id === `qd-1175-2021/${id}`);

  it('cites the credit caps where the glossary says they are', () => {
    expect(clause('d7/k2/b')).toMatchObject({ label: 'Điều 7, khoản 2, điểm b', pages: [6], chapter: { number: 'II' } });
    expect(clause('d7/k2/b')!.text).toContain('Đối với chương trình đại trà: tối đa là 25 tín chỉ.');
    expect(clause('d6/k4/b')!.text).toContain('03 học kỳ chính');
  });

  it('keeps the grade conversion table as one Markdown table across its page break', () => {
    expect(clause('d11/k1')!.pages).toEqual([9, 10]);
    expect(clause('d11/k1')!.text).toContain('| <3,0 | 0,0 | F |');
    expect(clause('d11/k1')!.text.match(/Thang điểm 10 \|/gu)).toHaveLength(1);
  });

  it('keeps both of the source’s repeated numbers apart', () => {
    expect(clause('d8/k3-2')).toMatchObject({ label: 'Điều 8, khoản 3 (thứ hai)', khoan: 3 });
    expect(clause('d10/k3/a-2')).toMatchObject({ label: 'Điều 10, khoản 3, điểm a (thứ hai)', diem: 'a' });
  });
});

// A two-page synthetic regulation in pdftotext -layout shape: page number first, paragraphs indented.
const SOURCE: RegulationSource = {
  id: 'test-doc',
  title: 'Test',
  shortName: 'T',
  decision: { number: '1/T', date: '2026-01-01', text: 'T' },
  issuer: 'T',
  sourceUrl: 'https://example.test/t.pdf',
  pdf: { sha256: '0', pages: 2 },
  textLayer: { command: 'pdftotext -layout', tool: 'test', sha256: '0' },
  notes: [],
};
const page = (number: number, lines: string[]) => [`        ${number}`, ...lines].join('\n');
const synthetic = (body: string[]) =>
  `${page(1, ['QUY CHẾ THỬ', '            Chương I', '         QUY ĐỊNH CHUNG', ...body])}\n\f${page(2, ['phần cuối trang.', '      Điều 9. Cuối', '      1. Hết.'])}\n\f`;

describe('extractRegulation', () => {
  it('reads chapters, wrapped titles, article-level text, a repeated khoản and the letter đ', () => {
    const document = extractRegulation(
      { ...SOURCE },
      synthetic([
        '      Điều 1. Một tiêu đề rất',
        '      dài',
        '      Văn bản ngay dưới Điều.',
        '      1. Khoản một',
        '      a) điểm a',
        '      b) điểm b',
        '      c) điểm c',
        '      d) điểm d',
        '      đ) điểm đ được viết',
        'tiếp theo dòng sau.',
        '      1. Khoản một lặp lại, kéo dài sang',
      ]).replace('Điều 9', 'Điều 2'),
      [],
    );
    expect(document.preamble).toBe('QUY CHẾ THỬ');
    expect(document.clauses.map((clause) => clause.label)).toEqual([
      'Điều 1',
      'Điều 1, khoản 1',
      'Điều 1, khoản 1, điểm a',
      'Điều 1, khoản 1, điểm b',
      'Điều 1, khoản 1, điểm c',
      'Điều 1, khoản 1, điểm d',
      'Điều 1, khoản 1, điểm đ',
      'Điều 1, khoản 1 (thứ hai)',
      'Điều 2, khoản 1',
    ]);
    expect(document.clauses[0]).toMatchObject({ id: 'test-doc/d1', article: { title: 'Một tiêu đề rất dài' }, chapter: { title: 'QUY ĐỊNH CHUNG' } });
    expect(document.clauses[6]).toMatchObject({ id: 'test-doc/d1/k1/dd', text: 'đ) điểm đ được viết tiếp theo dòng sau.' });
    expect(document.clauses[7]).toMatchObject({ id: 'test-doc/d1/k1-2', pages: [1, 2], text: '1. Khoản một lặp lại, kéo dài sang phần cuối trang.' });
    expect(document.clauses[7].note).toContain('second');
  });

  it('replaces an override’s lines with its block, and fails when it does not match exactly once', () => {
    const text = synthetic(['      Điều 1. A', '      1. Bảng:', '          x    y', '          1    2']).replace('Điều 9', 'Điều 2');
    const table: RegulationOverride = { kind: 'layout', page: 1, reason: 't', source: ['x y', '1 2'], replacement: ['| x | y |', '| --- | --- |', '| 1 | 2 |'] };
    expect(extractRegulation(SOURCE, text, [table]).clauses[0].text).toBe('1. Bảng:\n| x | y |\n| --- | --- |\n| 1 | 2 |\nphần cuối trang.');
    expect(() => extractRegulation(SOURCE, text, [{ ...table, source: ['z'] }])).toThrow(/matches 0 places/u);
    expect(() => extractRegulation(SOURCE, text, [{ ...table, page: 2 }])).toThrow(/matches 0 places/u);
  });

  it('fails on numbering it cannot explain', () => {
    const gap = synthetic(['      Điều 1. A', '      1. x']).replace('Điều 9', 'Điều 3');
    expect(() => extractRegulation(SOURCE, gap, [])).toThrow('Điều 3 follows Điều 1');
    const khoan = synthetic(['      Điều 1. A', '      1. x', '      3. y']).replace('Điều 9', 'Điều 2');
    expect(() => extractRegulation(SOURCE, khoan, [])).toThrow('khoản 3 follows khoản 1');
    const diem = synthetic(['      Điều 1. A', '      1. x', '      b) y']).replace('Điều 9', 'Điều 2');
    expect(() => extractRegulation(SOURCE, diem, [])).toThrow('điểm b follows điểm (none)');
    expect(() => extractRegulation({ ...SOURCE, pdf: { sha256: '0', pages: 3 } }, gap, [])).toThrow('the text has 2 pages');
  });

  it('fails when a page does not start with its number', () => {
    expect(() => pageLines('        1\nx\n\fy\n')).toThrow('page 2 does not start with its page number');
  });
});

describe('joinWrapped', () => {
  it('keeps a hyphen glued to a letter and drops the line break', () => {
    expect(joinWrapped('ĐHQG-', 'HCM')).toBe('ĐHQG-HCM');
  });
  it('joins with a space everywhere else, including a spaced dash', () => {
    expect(joinWrapped('quốc phòng -', 'an ninh')).toBe('quốc phòng - an ninh');
    expect(joinWrapped('kinh tế', '- xã hội')).toBe('kinh tế - xã hội');
  });
});

describe('parseLabel', () => {
  it('parses every level and repeated numbers', () => {
    expect(parseLabel('Điều 7')).toEqual({ article: 7, khoan: null, khoanOccurrence: 1, diem: null, diemOccurrence: 1 });
    expect(parseLabel('Điều 10, khoản 3, điểm a (thứ hai)')).toEqual({ article: 10, khoan: 3, khoanOccurrence: 1, diem: 'a', diemOccurrence: 2 });
    expect(idFromLabel('x', parseLabel('Điều 8, khoản 3 (thứ hai), điểm đ')!)).toBe('x/d8/k3-2/dd');
  });
  it('rejects anything else', () => {
    for (const label of ['Điều 7 khoản 2', 'điều 7', 'Điều 7, điểm a', 'Điều 7, khoản 2, điểm B', 'Article 7']) {
      expect(parseLabel(label), label).toBeNull();
    }
  });
});

describe('words and diffWords', () => {
  it('ignores Markdown table pipes and rule rows', () => {
    expect(words('a b\n| c | d |\n| --- | --- |\n| e | |')).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('reports removed and added words as hunks', () => {
    expect(diffWords(['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual([]);
    expect(diffWords(['a', 'b', 'c', 'd'], ['a', 'x', 'c'])).toEqual([
      { at: 1, removed: ['b'], added: ['x'] },
      { at: 3, removed: ['d'], added: [] },
    ]);
    expect(diffWords([], ['a'])).toEqual([{ at: 0, removed: [], added: ['a'] }]);
  });
  it('refuses a diff too large to be a residue', () => {
    expect(() => diffWords(['a', 'b', 'c'], ['x', 'y', 'z'], 2)).toThrow('more than 2 edits');
  });
});
