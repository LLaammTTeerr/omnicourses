import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apcs2024 } from './apcs-2024.js';
import { apcs2025 } from './apcs-2025.js';
import { apcsPrerequisiteTable } from './apcs-prerequisite-table.js';
import { apcsPrerequisites } from './apcs-prerequisites.js';
import type { CurriculumSeed, PrerequisiteTableColumn, PrerequisiteTableSource, PrintedPrerequisiteRow } from './seed-types.js';

// Every value of the table must be the PDF's own text. Each column is read
// from its crop of the text layer, cell after cell in page order, and the
// whole-page text ties each row's code to its credits and to the first line of
// its prerequisite cell. A failure means a transcription error; the fix is the
// data, never a weaker check.
//
// The second half pins what the table says next to the other sources, so a
// reviewer sees every disagreement. Nothing here decides a rule.

const SOURCES = join(__dirname, 'sources');
const read = (file: string): string => readFileSync(join(SOURCES, file), 'utf8');
const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

const table = apcsPrerequisiteTable;
const rows = table.rows;
const source = JSON.parse(read(`${table.source.id}.source.json`)) as PrerequisiteTableSource;
const layers = Object.fromEntries(source.columns.map((c) => [c.field, read(c.file)])) as Record<PrerequisiteTableColumn, string>;
const whole = read(source.textLayer.file);

/** The header label each column's crop repeats on every page, line by line. */
const HEADERS: Record<PrerequisiteTableColumn, string[]> = {
  code: ['Mã', 'môn'],
  name_en: ['Tên TA'],
  name_vi: ['Tên tiếng', 'Việt'],
  credits: ['Số tín', 'chỉ'],
  prerequisites: ['Điều', 'kiện tiên', 'quyết'],
};

/** Pages of a text layer (index 0 = page 1). */
function pagesOf(text: string): string[] {
  const pages = text.split('\f');
  if (pages.at(-1)?.trim() === '') pages.pop();
  return pages;
}

/** The non-blank lines of a page, trimmed, runs of spaces collapsed. */
const linesOf = (page: string): string[] =>
  page
    .normalize('NFC')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '');

/** The lines a column prints under its header, over all pages in order. */
function columnLines(field: PrerequisiteTableColumn): string[] {
  const header = HEADERS[field];
  return pagesOf(layers[field]).flatMap((page, index) => {
    const lines = linesOf(page);
    const at = lines.findIndex((_, i) => header.every((label, j) => lines[i + j] === label));
    expect(at, `${field} header on page ${index + 1}`).toBeGreaterThanOrEqual(0);
    return lines.slice(at + header.length);
  });
}

/**
 * Hands the column's lines to the rows in order: each row takes lines until
 * they make its value, and no line may be left over. A null value takes none.
 */
function cellsOf(field: PrerequisiteTableColumn, value: (row: PrintedPrerequisiteRow) => string | null, makes: (lines: string[], value: string) => boolean): string[][] {
  const lines = columnLines(field);
  let next = 0;
  const cells = rows.map((row) => {
    const wanted = value(row);
    if (wanted === null) return [];
    for (let end = next + 1; end <= Math.min(next + 8, lines.length); end++) {
      if (makes(lines.slice(next, end), wanted)) {
        const cell = lines.slice(next, end);
        next = end;
        return cell;
      }
    }
    throw new Error(`${field} of ${row.code}: "${wanted}" is not what the column prints next (${lines.slice(next, next + 4).join(' | ')})`);
  });
  expect(lines.slice(next), `${field}: lines after the last row`).toEqual([]);
  return cells;
}

const joined = (separator: string) => (lines: string[], value: string) => lines.join(separator) === value;
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A name: each line break is one space or nothing. */
const wrapped = (lines: string[], value: string): boolean => new RegExp(`^${lines.map(escape).join(' ?')}$`).test(value);

const creditsPrinted = (row: PrintedPrerequisiteRow): string => row.credits_printed ?? String(row.credits);

const codeCells = cellsOf('code', (r) => r.code, joined(''));
const nameEnCells = cellsOf('name_en', (r) => r.name_en, wrapped);
const nameViCells = cellsOf('name_vi', (r) => r.name_vi, wrapped);
const creditCells = cellsOf('credits', creditsPrinted, joined(' '));
const prerequisiteCells = cellsOf('prerequisites', (r) => r.printed, joined(' '));

const CODE = /^[A-Z]{2,4}\d{3}$/;

/** The one rule `resolved` and `unresolved` may follow. */
function resolve(printed: string | null): { resolved: string[]; unresolved: string[] } {
  const resolved: string[] = [];
  const unresolved: string[] = [];
  if (printed === null || printed === 'None') return { resolved, unresolved };
  for (const part of printed.split(',').map((p) => p.trim())) {
    const code = part.replace(/\s+/g, '');
    if (!CODE.test(code)) unresolved.push(part);
    else if (!resolved.includes(code)) resolved.push(code);
  }
  return { resolved, unresolved };
}

const codesOf = (seed: CurriculumSeed): Set<string> => new Set(seed.groups.flatMap((g) => g.rows.map((r) => r.code)));
const rowCodes = new Set(rows.map((r) => r.code));
const list = (codes: string[]): string => (codes.length === 0 ? 'none' : codes.join(' '));

describe('APCS prerequisite table (CTTT-Bang-mo-ta-tom-tat-mon-hoc.pdf)', () => {
  describe('source', () => {
    it('reads the text layers its metadata names', () => {
      expect(sha256(whole)).toBe(source.textLayer.sha256);
      expect(source.columns.map((c) => c.field)).toEqual(['code', 'name_en', 'name_vi', 'credits', 'prerequisites']);
      for (const column of source.columns) {
        expect(sha256(layers[column.field]), column.file).toBe(column.sha256);
        expect(pagesOf(layers[column.field]), column.file).toHaveLength(source.pdf.pages);
        expect(column.command, column.file).toMatch(/^pdftotext -layout -x \d+ -y 0 -W \d+ -H 545$/);
      }
      expect(pagesOf(whole)).toHaveLength(source.pdf.pages);
    });

    it('names the same PDF as the table, and claims no issue date', () => {
      expect(table.source).toEqual({
        id: source.id,
        file: source.pdf.file,
        pages: source.pdf.pages,
        sha256: source.pdf.sha256,
        sourceUrl: source.sourceUrl,
        issued: source.issued,
      });
      expect(source.issued).toBeNull();
      expect(source.pdf.created).toBe('2019-07-30T11:53:00+07:00');
      expect(source.sourceUrl).toContain(`/uploads/${source.urlPathDate}/${source.pdf.file}`);
    });

    it('prints the title and the column heading', () => {
      const first = linesOf(pagesOf(whole)[0]).join(' ');
      expect(first).toContain(source.title.toUpperCase());
      expect(HEADERS.prerequisites.join(' ')).toBe(table.field);
    });
  });

  describe('rows against the text of the PDF', () => {
    it('lists every row of the code column once, in order', () => {
      expect(rows).toHaveLength(56);
      expect(codeCells).toHaveLength(56);
      expect(rowCodes.size).toBe(rows.length);
      expect(rows.map((r) => r.page)).toEqual([...rows.map((r) => r.page)].sort((a, b) => a - b));
    });

    it('has every English and Vietnamese name as printed', () => {
      expect(nameEnCells).toHaveLength(rows.length);
      expect(nameViCells).toHaveLength(rows.length);
      for (const r of rows) {
        expect(r.name_en, r.code).toBe(r.name_en.normalize('NFC').trim());
        expect(r.name_vi, r.code).toBe(r.name_vi.normalize('NFC').trim());
      }
    });

    it('joins a line break inside a name with nothing only in these rows', () => {
      const closed = (cells: string[][], name: (r: PrintedPrerequisiteRow) => string) =>
        rows.flatMap((r, i) => (cells[i].join(' ') === name(r) ? [] : [`${r.code}: ${cells[i].join(' | ')}`]));
      expect(closed(nameEnCells, (r) => r.name_en)).toEqual([
        'CS311: Computation | al Structures',
        'CM101: Communicati | on | Management',
        'CS430: Human- | Computer | Interaction',
        'CS494: Internetworki | ng Protocols',
        'CS405: Open | Economy, | Entrepreneur | ship & | Education',
        'CS407: Technology- | based | Innovation | and | Leadership',
        'CS408: Computation | al Finance',
        'CS409: Enterpreneur | ship',
      ]);
      expect(closed(nameViCells, (r) => r.name_vi)).toEqual([]);
    });

    it('has the credits as printed', () => {
      rows.forEach((r, i) => {
        expect(creditCells[i], r.code).toEqual([creditsPrinted(r)]);
        expect(Number(creditsPrinted(r)), r.code).toBe(r.credits);
        if (r.credits_printed !== undefined) expect(r.credits_printed, r.code).not.toBe(String(r.credits));
      });
      expect(rows.filter((r) => r.credits_printed !== undefined).map((r) => `${r.code} ${r.credits_printed}`)).toEqual(['PH215 01', 'PH216 01']);
    });

    it('has every prerequisite cell as printed, line breaks as one space', () => {
      expect(prerequisiteCells).toHaveLength(rows.length);
      rows.forEach((r, i) => expect(prerequisiteCells[i].join(' '), r.code).toBe(r.printed ?? ''));
    });

    it('ties each code to its credits and the first line of its cell on one line of its page', () => {
      const lines = pagesOf(whole).flatMap((page, index) => linesOf(page).map((text) => ({ text, page: index + 1 })));
      let from = 0;
      rows.forEach((r, i) => {
        const start = `${codeCells[i][0]} ${nameEnCells[i][0]} `;
        const at = lines.findIndex((line, n) => n >= from && line.text.startsWith(start));
        expect(at, `${r.code}: a line starting "${start}"`).toBeGreaterThanOrEqual(0);
        const end = [creditCells[i][0], ...prerequisiteCells[i].slice(0, 1)].join(' ');
        expect(lines[at].text.endsWith(` ${end}`), `${r.code}: "${lines[at].text}" ends with "${end}"`).toBe(true);
        expect(lines[at].page, r.code).toBe(r.page);
        from = at + 1;
      });
    });

    it('breaks one cell over two pages', () => {
      const perPage = pagesOf(layers.prerequisites).map((page) => linesOf(page).slice(HEADERS.prerequisites.length));
      expect(perPage[35]).toEqual(['CS251', 'MATH2', '51,']);
      expect(perPage[36]).toEqual(['CS161,', 'CS162,', 'CS163,', 'CS350', 'STAT45', '1']);
      expect(rows.find((r) => r.code === 'MTH346')).toMatchObject({ printed: 'MATH2 51, CS161, CS162, CS163, CS350', page: 36 });
    });

    it('prints no offering terms', () => {
      expect(table.offering_terms).toEqual([]);
    });
  });

  describe('resolved and unresolved', () => {
    it('follow from the printed cell alone', () => {
      for (const r of rows) {
        expect({ resolved: r.resolved, unresolved: r.unresolved }, r.code).toEqual(resolve(r.printed));
        expect(r.resolved, r.code).not.toContain(r.code);
      }
    });

    it('tell None from an empty cell, a code from free text', () => {
      expect(resolve(null)).toEqual({ resolved: [], unresolved: [] });
      expect(resolve('None')).toEqual({ resolved: [], unresolved: [] });
      expect(resolve('CS 161, MATH2 51')).toEqual({ resolved: ['CS161', 'MATH251'], unresolved: [] });
      expect(resolve('CS161, Calculus I or equivalent')).toEqual({ resolved: ['CS161'], unresolved: ['Calculus I or equivalent'] });
    });

    it('counts the cells by kind', () => {
      const kind = (r: PrintedPrerequisiteRow) => (r.printed === null ? 'empty' : r.printed === 'None' ? 'none' : r.unresolved.length > 0 ? 'free text' : 'codes only');
      const count = (k: string) => rows.filter((r) => kind(r) === k).length;
      expect({ 'codes only': count('codes only'), none: count('none'), empty: count('empty'), 'free text': count('free text') }).toEqual({
        'codes only': 23,
        none: 33,
        empty: 0,
        'free text': 0,
      });
    });
  });

  // Pinned so that they are visible. None of this is a rule.
  describe('what the table says, next to the other sources', () => {
    it('names codes that are no row of the table', () => {
      const strangers = rows.flatMap((r) => r.resolved.filter((c) => !rowCodes.has(c)).map((c) => `${r.code} -> ${c}`));
      expect(strangers).toEqual(['CS320 -> CS200', 'CS333 -> CS200', 'MTH252 -> MATH251', 'MTH253 -> MATH252', 'CS419 -> MATH261', 'MTH346 -> MATH251']);
    });

    it('has no prerequisite cycle', () => {
      const requires = new Map(rows.map((r) => [r.code, r.resolved]));
      const cycles: string[] = [];
      const walk = (code: string, path: string[]): void => {
        if (path.includes(code)) {
          cycles.push([...path.slice(path.indexOf(code)), code].join(' -> '));
          return;
        }
        for (const next of requires.get(code) ?? []) walk(next, [...path, code]);
      };
      for (const r of rows) walk(r.code, []);
      expect(cycles).toEqual([]);
    });

    it('uses codes the 2024 and 2025 curricula do not list', () => {
      const curricula = new Set([...codesOf(apcs2024), ...codesOf(apcs2025)]);
      const used = [...new Set(rows.flatMap((r) => [r.code, ...r.resolved]))];
      expect(used.filter((c) => !curricula.has(c)).sort()).toEqual([
        'CM101',
        'CS161',
        'CS162',
        'CS200',
        'CS305',
        'CS429',
        'CS487-CS488',
        'KT006',
        'MATH251',
        'MATH252',
        'MATH261',
        'PH214',
        'PH215',
        'PH216',
        'PH221',
        'PH222',
        'PH223',
      ]);
    });

    it('leaves courses of the 2024 and 2025 curricula without a row', () => {
      const uncovered = (seed: CurriculumSeed) => [...codesOf(seed)].filter((c) => !rowCodes.has(c)).sort();
      const general = ['BAA00003', 'BAA00004', 'BAA00021', 'BAA00022', 'BAA00030', 'BAA00101', 'BAA00102', 'BAA00103', 'BAA00104'];
      const before = ['CM102', 'CS160', 'CS252', 'CS323', 'CS414', 'CS415', 'CS416', 'CS432', 'CS433', 'CS434', 'CS435'];
      const after = ['CS468', 'CS469', 'CS470', 'PH211', 'PH212', 'PH213'];
      expect(uncovered(apcs2024)).toEqual([...general, ...before, ...after]);
      expect(uncovered(apcs2025)).toEqual([...general, ...before, 'CS436', 'CS437', ...after]);
    });

    it('agrees and disagrees with the Prior-course lines of the March 2021 booklet', () => {
      // A blank Prior-course line names no course and has no free text.
      const booklet = new Map<string, { resolved: string[]; unresolved: string[] }>();
      for (const l of apcsPrerequisites.lines) booklet.set(l.code, { resolved: l.resolved, unresolved: l.unresolved });
      for (const b of apcsPrerequisites.blank) booklet.set(b.code, { resolved: [], unresolved: [] });
      const same = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join();
      const both = rows.filter((r) => booklet.has(r.code));
      const line = (r: PrintedPrerequisiteRow) => `${r.code}: table ${list(r.resolved)} | booklet ${list(booklet.get(r.code)!.resolved)}`;

      // The booklet line names only courses, and the same ones.
      const agree = both.filter((r) => booklet.get(r.code)!.unresolved.length === 0 && same(r.resolved, booklet.get(r.code)!.resolved));
      // The booklet line names only courses, and other ones.
      const disagree = both.filter((r) => booklet.get(r.code)!.unresolved.length === 0 && !same(r.resolved, booklet.get(r.code)!.resolved));
      // The booklet line has free text, so its codes are not the whole line.
      const freeText = both.filter((r) => booklet.get(r.code)!.unresolved.length > 0);

      expect(agree.map(line)).toEqual([
        'CS161: table none | booklet none',
        'CS162: table CS161 | booklet CS161',
        'CS163: table CS162 | booklet CS162',
        'CS201: table CS161 CS162 | booklet CS161 CS162',
        'CS250: table none | booklet none',
        'CS305: table none | booklet none',
        'CM101: table none | booklet none',
        'SC203: table none | booklet none',
        'MTH251: table none | booklet none',
        'STAT451: table CS250 CS251 | booklet CS250 CS251',
        'CS412: table none | booklet none',
        'CS417: table none | booklet none',
        'CS422: table none | booklet none',
        'CS428: table none | booklet none',
        'CS431: table none | booklet none',
        'STAT452: table STAT451 | booklet STAT451',
        'CS405: table none | booklet none',
        'CS408: table none | booklet none',
      ]);
      expect(disagree.map(line)).toEqual([
        'CS202: table none | booklet CS162',
        'CS350: table CS311 | booklet MTH251',
        'MTH252: table MATH251 | booklet MTH251',
        'CS411: table CS202 MTH261 | booklet none',
        'CS418: table CS162 | booklet none',
        'CS426: table none | booklet CS202',
        'CS427: table none | booklet CS202',
        'CS430: table CS202 | booklet none',
        'CS404: table none | booklet CM101 CS202 CS300 CS486 SC203 WR227',
        'CS409: table none | booklet CS305',
      ]);
      expect(freeText.map((r) => `${line(r)} + ${booklet.get(r.code)!.unresolved.map((u) => `"${u}"`).join(', ')}`)).toEqual([
        'CS251: table CS250 | booklet none + "Discrete Structures"',
        'CS300: table CS202 | booklet none + "Basic application programming skills"',
        'CS311: table CS251 | booklet none + "Discrete Structures I Data Structures"',
        'CS320: table CS200 CS201 CS311 | booklet none + "CS 202 Programming Systems Object-oriented programming", "practical data structures", "Java", "CS 251 Data Structures II Mathematical logic and proofs", "CS 311 Computational Structures Formal languages and grammars", "automata and Turing machines"',
        'CS333: table CS200 CS201 CS311 | booklet none + "Computer Systems"',
        'CS486: table CS163 CS250 CS251 | booklet none + "Discrete Mathematics"',
        'ECE341: table none | booklet none + "System Programming"',
        'WR227: table SC203 | booklet none + "Scientific Research Methodologies"',
        'MTH253: table MATH252 | booklet none + "Calculus 1", "Calculus 2"',
        'CS419: table CS163 STAT451 MATH261 | booklet none + "Introduction to programming language", "Data Structure", "Calculus", "Linear Algebra"',
        'CS420: table CS202 CS311 | booklet none + "Data Structures and Algorithms"',
        'CS421: table none | booklet none + "Introduction to Software Engineering"',
        'CS423: table none | booklet CS424 + "OOP", "Database", "Software Engineering"',
        'CS424: table none | booklet CS300 + "Introduction to Computer Science", "Introduction to Databases"',
        'CS429: table none | booklet none + "Data mining", "Machine learning"',
        'CS494: table none | booklet none + "Introduction to Programming (C", "C++", "Java) or equivalent"',
        'MTH261: table none | booklet none + "Calculus I & II"',
        'MTH344: table CS251 | booklet none + "Discrete Mathematics"',
        'MTH346: table MATH251 CS161 CS162 CS163 CS350 | booklet none + "Basic calculus", "Programming", "Algorithms and Data structures", "Algorithms Analysis"',
        'CS407: table none | booklet none + "Scientific Methods"',
      ]);
      // In the table only, and in the booklet only.
      expect(rows.filter((r) => !booklet.has(r.code)).map((r) => r.code)).toEqual(['CS487-CS488', 'PH214', 'PH215', 'PH216', 'PH221', 'PH222', 'PH223', 'KT006']);
      expect([...booklet.keys()].filter((c) => !rowCodes.has(c)).sort()).toEqual(['CS386', 'CS415', 'CS416', 'CS432', 'CS433', 'CS434', 'CS469', 'CS470', 'PH211', 'PH212', 'PH213']);
      expect(agree.length + disagree.length + freeText.length).toBe(48);
    });
  });
});
