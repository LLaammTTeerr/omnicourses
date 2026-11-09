import { describe, expect, it } from 'vitest';
import { readCourseDescriptions } from '../../advisor/course-descriptions/course-description-files.js';
import { normalizePrintedCode } from '../../common/course-code.js';
import { apcsPrerequisites } from './apcs-prerequisites.js';

// The printed lines are checked against the PDF's text by
// course-descriptions.spec.ts; here they are checked against that extraction,
// and `resolved` / `unresolved` against the one rule they may follow: a part
// names a course only by its exact code or its exact heading.

const booklet = readCourseDescriptions('apcs-course-descriptions-2021').document;
const byCode = new Map(booklet.courses.map((c) => [c.code, c]));

/** The course a part of a line names exactly, if any. */
function lookup(part: string): string | undefined {
  if (/^[A-Za-z]{2,4}\s?\d{3}[A-Za-z]?$/.test(part) && byCode.has(normalizePrintedCode(part))) return normalizePrintedCode(part);
  const titled = booklet.courses.filter((e) => e.name_en === part);
  return titled.length === 1 ? titled[0].code : undefined;
}

/** Splits a line at ", ", taking the longest run of parts that names a course. */
function resolve(printed: string): { resolved: string[]; unresolved: string[] } {
  const parts = printed.split(', ').map((p) => p.trim());
  const resolved: string[] = [];
  const unresolved: string[] = [];
  let i = 0;
  while (i < parts.length) {
    let j = parts.length;
    let hit: string | undefined;
    for (; j > i; j--) {
      hit = lookup(parts.slice(i, j).join(', '));
      if (hit) break;
    }
    if (hit) {
      if (!resolved.includes(hit)) resolved.push(hit);
      i = j;
    } else {
      unresolved.push(parts[i]);
      i++;
    }
  }
  return { resolved, unresolved };
}

describe('APCS printed prerequisites (Prior-course lines)', () => {
  it('names the same PDF as the course descriptions', () => {
    expect(apcsPrerequisites.source.file).toBe(booklet.pdf.file);
    expect(apcsPrerequisites.source.sha256).toBe(booklet.pdf.sha256);
    expect(apcsPrerequisites.source.pages).toBe(booklet.pdf.pages);
  });

  it('lists every course of the booklet once, as a line or as blank', () => {
    const codes = [...apcsPrerequisites.lines.map((l) => l.code), ...apcsPrerequisites.blank.map((b) => b.code)];
    expect(new Set(codes).size).toBe(codes.length);
    expect([...codes].sort()).toEqual([...byCode.keys()].sort());
    expect(apcsPrerequisites.lines).toHaveLength(41);
    expect(apcsPrerequisites.blank).toHaveLength(18);
  });

  it('copies each line and page from the extracted description', () => {
    for (const l of apcsPrerequisites.lines) {
      expect(l.printed, l.code).toBe(byCode.get(l.code)!.prerequisites_printed);
      expect(l.page, l.code).toBe(byCode.get(l.code)!.pages[0]);
    }
    for (const b of apcsPrerequisites.blank) {
      expect(byCode.get(b.code)!.prerequisites_printed, b.code).toBeNull();
      expect(b.page, b.code).toBe(byCode.get(b.code)!.pages[0]);
    }
  });

  it('resolves only exact codes and exact course headings, and keeps the rest', () => {
    for (const l of apcsPrerequisites.lines) {
      expect({ resolved: l.resolved, unresolved: l.unresolved }, l.code).toEqual(resolve(l.printed));
      expect(l.resolved, l.code).not.toContain(l.code);
    }
  });

  it('prints no offering terms', () => {
    expect(apcsPrerequisites.offering_terms).toEqual([]);
  });
});
