import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CourseDescriptionSource } from './source-types.js';

// Reads the committed source documents and normalises their text, so tests can
// check that an extracted entry is the document's own words.

/** A JSON source of this folder, by file name. */
export function readCourseDescriptions(file: string): CourseDescriptionSource {
  return JSON.parse(readFileSync(join(__dirname, file), 'utf8')) as CourseDescriptionSource;
}

// Lines every page of the APCS course-description booklet repeats: the
// two-column letterhead and the bare page number in the footer.
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

/**
 * The committed `pdftotext -layout` output of a document, split at form feeds
 * into pages (index 0 = page 1), with the letterhead and page-number lines
 * dropped. Lines are kept so that a range of pages can be normalised together.
 */
export function sourcePages(textPath: string): string[] {
  const raw = readFileSync(join(__dirname, textPath), 'utf8');
  const pages = raw.split('\f');
  if (pages.at(-1)?.trim() === '') pages.pop();
  return pages.map((page) =>
    page
      .split('\n')
      .filter((line) => !BOILERPLATE.some((re) => re.test(line)))
      .join('\n'),
  );
}

/** Normalised text of pages `first` to `last` (1-based, inclusive). */
export function pageRange(pages: string[], first: number, last: number): string {
  return normalise(pages.slice(first - 1, last).join('\n'));
}
