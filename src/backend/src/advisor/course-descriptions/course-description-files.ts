import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CourseDescriptionDocument, CourseDescriptionSource } from './course-description.js';

// Reads a course-description document and its inputs, and normalises the text
// layer the way the extraction joined it.

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

export const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

export interface CourseDescriptionInputs {
  document: CourseDescriptionDocument;
  source: CourseDescriptionSource;
  pdftotext: string;
}

/** Reads `<id>.json`, `sources/<id>.source.json` and `sources/<id>.pdftotext.txt`. */
export function readCourseDescriptions(id: string, dir = __dirname): CourseDescriptionInputs {
  return {
    document: readJson<CourseDescriptionDocument>(join(dir, `${id}.json`)),
    source: readJson<CourseDescriptionSource>(join(dir, 'sources', `${id}.source.json`)),
    pdftotext: readFileSync(join(dir, 'sources', `${id}.pdftotext.txt`), 'utf8'),
  };
}

// Lines every page of the APCS booklet repeats: the two-column letterhead and
// the bare page number in the footer.
const BOILERPLATE = [
  /^\s*VIET NAM NATIONAL UNIVERSITY\s+SOCIALIST REPUBLIC OF VIETNAM\s*$/,
  /^\s*HO CHI MINH CITY\s+Independence - Freedom - Happiness\s*$/,
  /^\s*UNIVERSITY OF SCIENCE\s+_+o 0 o_+\s*$/,
  /^\s*\d{1,3}\s*$/,
];

/**
 * Collapses text the way the extraction joined it: a line break after a
 * non-space "-" disappears, every other run of whitespace becomes one space.
 */
export function normalise(text: string): string {
  return text
    .normalize('NFC')
    .replace(/(\S-)[ \t]*\n\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The text layer split at form feeds (index 0 = page 1), without the boilerplate lines. */
export function pagesOf(pdftotext: string): string[] {
  const pages = pdftotext.split('\f');
  if (pages.at(-1)?.trim() === '') pages.pop();
  return pages.map((page) =>
    page
      .split('\n')
      .filter((line) => !BOILERPLATE.some((re) => re.test(line)))
      .join('\n'),
  );
}

/** Normalised text of the given 1-based pages, in order. */
export function textOfPages(pages: string[], numbers: number[]): string {
  return normalise(numbers.map((n) => pages[n - 1]).join('\n'));
}
