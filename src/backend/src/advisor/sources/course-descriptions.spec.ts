import { describe, expect, it } from 'vitest';
import { normalise, pageRange, readCourseDescriptions, sourcePages } from './source-text.js';

// Every extracted entry must be the booklet's own words: each field is looked
// up in the normalised `pdftotext -layout` output of its pages. A failure means
// an extraction error; the fix is the data, never a weaker check.

const source = readCourseDescriptions('apcs-course-descriptions.json');
const pages = sourcePages(source.document.text);

describe('APCS course descriptions (APCS_Program_Descriptions.pdf)', () => {
  it('covers every page of the PDF and every course of its table of contents', () => {
    expect(pages).toHaveLength(source.document.pages);
    const toc = normalise(pages.slice(1, 3).join('\n'));
    const listed = [...toc.matchAll(/([A-Z]{2,4}\d{3}) – /g)].map((m) => m[1]);
    expect(listed).toHaveLength(59);
    expect(source.entries.map((e) => e.code).sort()).toEqual([...listed].sort());
  });

  it('has unique, stable ids', () => {
    const ids = source.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of source.entries) expect(e.id).toBe(`${source.document.id}/${e.code}`);
  });

  it('starts each entry on the page its table of contents gives', () => {
    const toc = normalise(pages.slice(1, 3).join('\n'));
    for (const e of source.entries) {
      const m = new RegExp(`${e.code} – [^.]+?\\.{3,} ?(\\d+)`).exec(toc);
      expect(m, e.code).not.toBeNull();
      expect(Number(m![1]), e.code).toBe(e.page);
    }
  });

  describe.each(source.entries.map((e) => [e.code, e] as const))('%s', (_, e) => {
    const first = pageRange(pages, e.page, e.page);
    const all = pageRange(pages, e.page, e.last_page);

    it('has its heading, code, block and credits on its first page', () => {
      expect(first).toContain(`${e.code} – ${e.name_en} ❖ General information`);
      expect(first).toContain(`Course ID : ${e.code}`);
      expect(first).toContain(`Knowledge block : ${e.knowledge_block} −`);
      expect(first).toMatch(new RegExp(`Number of credits :\\s?${e.credits} `));
      expect(e.name_vi).toBeNull();
    });

    it('has its Prior-course line as printed', () => {
      const printed = e.prerequisites_printed === null ? '' : `${e.prerequisites_printed} `;
      expect(first).toContain(`Prior-course : ${printed}❖`);
    });

    it('has its description, goals and content in the text of its pages', () => {
      expect(e.description.length).toBeGreaterThan(0);
      expect(all).toContain(`Course description ${e.description} ❖`);
      for (const item of [...e.goals, ...e.content]) expect(all).toContain(item);
      expect(e.content.length + e.goals.length).toBeGreaterThan(0);
    });

    it('ends before the next entry starts', () => {
      const next = source.entries.find((other) => other.page > e.page && other.page <= e.last_page);
      expect(next).toBeUndefined();
    });
  });
});
