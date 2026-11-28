import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { advisorSourceDir, readJson } from '../regulations/regulation-files.js';
import type { CourseDescriptionDocument, CourseDescriptionSource } from './course-description.js';

interface CourseDescriptionInputs {
  document: CourseDescriptionDocument;
  source: CourseDescriptionSource;
  pdftotext: string;
}

export function readCourseDescriptions(id: string, dir = advisorSourceDir('course-descriptions')): CourseDescriptionInputs {
  return {
    document: readJson<CourseDescriptionDocument>(join(dir, `${id}.json`)),
    source: readJson<CourseDescriptionSource>(join(dir, 'sources', `${id}.source.json`)),
    pdftotext: readFileSync(join(dir, 'sources', `${id}.pdftotext.txt`), 'utf8'),
  };
}

const BOILERPLATE = [
  /^\s*VIET NAM NATIONAL UNIVERSITY\s+SOCIALIST REPUBLIC OF VIETNAM\s*$/,
  /^\s*HO CHI MINH CITY\s+Independence - Freedom - Happiness\s*$/,
  /^\s*UNIVERSITY OF SCIENCE\s+_+o 0 o_+\s*$/,
  /^\s*\d{1,3}\s*$/,
];

export function normalise(text: string): string {
  return text
    .normalize('NFC')
    .replace(/(\S-)[ \t]*\n\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

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

export function textOfPages(pages: string[], numbers: number[]): string {
  return normalise(numbers.map((n) => pages[n - 1]).join('\n'));
}
