import { describe, expect, it } from 'vitest';
import { normalise, pagesOf, readCourseDescriptions, sha256, textOfPages } from './course-description-files.js';

// Every extracted course must be the booklet's own words: each field is looked
// up in the normalised text layer of its pages. A failure means an extraction
// error; the fix is the data, never a weaker check.

const { document, source, pdftotext } = readCourseDescriptions('apcs-course-descriptions-2021');
const pages = pagesOf(pdftotext);
const toc = textOfPages(pages, [2, 3]);

describe('APCS course descriptions (APCS_Program_Descriptions.pdf)', () => {
  it('reads the text layer its metadata names, and repeats that metadata', () => {
    expect(sha256(pdftotext)).toBe(source.textLayer.sha256);
    const { courses, ...metadata } = document;
    expect(metadata).toEqual(source);
    expect(courses.length).toBeGreaterThan(0);
  });

  it('covers every page of the PDF and every course of its table of contents', () => {
    expect(pages).toHaveLength(source.pdf.pages);
    const listed = [...toc.matchAll(/([A-Z]{2,4}\d{3}) – /g)].map((m) => m[1]);
    expect(listed).toHaveLength(59);
    expect(document.courses.map((c) => c.code).sort()).toEqual([...listed].sort());
  });

  it('has unique, stable ids', () => {
    const ids = document.courses.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of document.courses) expect(c.id).toBe(`${source.id}/${c.code}`);
  });

  it('starts each course on the page its table of contents gives, and runs over consecutive pages', () => {
    for (const c of document.courses) {
      const m = new RegExp(`${c.code} – [^.]+?\\.{3,} ?(\\d+)`).exec(toc);
      expect(m, c.code).not.toBeNull();
      expect(Number(m![1]), c.code).toBe(c.pages[0]);
      expect(c.pages, c.code).toEqual(c.pages.map((_, i) => c.pages[0] + i));
    }
  });

  it('gives no page to two courses', () => {
    const owners = document.courses.flatMap((c) => c.pages);
    expect(new Set(owners).size).toBe(owners.length);
  });

  describe.each(document.courses.map((c) => [c.code, c] as const))('%s', (_, c) => {
    const first = textOfPages(pages, [c.pages[0]]);
    const all = textOfPages(pages, c.pages);

    it('has its heading, code, block and credits on its first page', () => {
      expect(first).toContain(`${c.code} – ${c.name_en} ❖ General information`);
      expect(first).toContain(`Course ID : ${c.code}`);
      expect(first).toContain(`Knowledge block : ${c.knowledge_block} −`);
      expect(first).toMatch(new RegExp(`Number of credits :\\s?${c.credits} `));
      expect(c.name_vi).toBeNull();
    });

    it('has its Prior-course line as printed', () => {
      const printed = c.prerequisites_printed === null ? '' : `${c.prerequisites_printed} `;
      expect(first).toContain(`Prior-course : ${printed}❖`);
    });

    it('has its description, goals and content in the text of its pages', () => {
      expect(c.description.length).toBeGreaterThan(0);
      expect(all).toContain(`Course description ${c.description} ❖`);
      expect(c.goals.length + c.content.length).toBeGreaterThan(0);
      for (const item of [...c.goals, ...c.content]) expect(all).toContain(normalise(item));
    });
  });
});
