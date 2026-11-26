/**
 * Regulation clauses: from a regulation PDF's `pdftotext -layout` output to clause data (F8, step 1).
 *
 * Every function here is deterministic. A model may only have written entries in a document's
 * overrides file, and the verification spec proves the clause texts hold every source word in order,
 * except for the residue those overrides declare (ADR 0003, AGENTS.md hard rule 1).
 */

/** Hand-written facts about the source PDF: `sources/<id>.source.json`. */
export interface RegulationSource {
  /** Lower-case words joined by hyphens, e.g. `qd-1175-2021`; the prefix of every clause id. */
  id: string;
  /** The title as printed, in sentence case. */
  title: string;
  /** How a student names the document in a citation, e.g. `QĐ 1175/QĐ-KHTN`. */
  shortName: string;
  /** The issuing decision, as printed. */
  decision: { number: string; date: string; text: string };
  issuer: string;
  sourceUrl: string;
  pdf: { sha256: string; pages: number };
  /** The committed `sources/<id>.pdftotext.txt`: the tool that wrote it and its sha256. */
  textLayer: { command: string; tool: string; sha256: string };
  /** Facts a reader needs that are not clauses, e.g. an appendix the PDF leaves out. */
  notes: string[];
}

/**
 * One hand correction: `sources/<id>.overrides.json`. It replaces a run of source lines (blank lines
 * skipped) on `page` with `replacement`, kept verbatim as one block.
 * - `layout`: the words stay identical in order, only their layout changes (tables). The spec enforces it.
 * - `text`: the words change (an unreadable formula, a header repeated by a page break). The spec reports
 *   exactly these as the residue.
 */
export interface RegulationOverride {
  kind: 'layout' | 'text';
  page: number;
  reason: string;
  source: string[];
  replacement: string[];
}

export interface Clause {
  /** `<document>/d<article>[/k<khoan>[/<diem>]]`, with `-2` on the second use of a number the source repeats. */
  id: string;
  /** The citation as a student writes it: `Điều 7, khoản 2, điểm b`. */
  label: string;
  level: 'article' | 'khoan' | 'diem';
  chapter: { number: string; title: string };
  article: { number: number; title: string };
  khoan: number | null;
  diem: string | null;
  /** Printed page numbers, which equal the PDF page numbers in the documents so far. */
  pages: number[];
  /** The exact wording, marker included; paragraphs separated by `\n`, tables as Markdown. */
  text: string;
  /** Present when the source numbering needs explaining (a repeated khoản or điểm). */
  note?: string;
}

export interface RegulationDocument extends RegulationSource {
  /** The heading block before Chương I, one paragraph per line. */
  preamble: string;
  clauses: Clause[];
  /** The `Nơi nhận` block after the last Điều, line by line. */
  closing: string;
}

interface Line {
  raw: string;
  page: number;
}

interface Unit {
  /** `paragraph` is reflowed body text; `block` is an override's replacement, kept line by line. */
  kind: 'paragraph' | 'block';
  text: string;
  pages: number[];
}

/** Whitespace runs collapse to one space; text is NFC. */
export const collapse = (text: string): string => text.normalize('NFC').replace(/\s+/gu, ' ').trim();

/**
 * Splits the pdftotext output into lines with their page, dropping only the page number each page
 * prints as its first line. Throws when a page does not start with its own number.
 */
export function pageLines(pdftotext: string): Line[] {
  const pages = pdftotext.replace(/\f$/u, '').split('\f');
  const lines: Line[] = [];
  pages.forEach((pageText, index) => {
    const page = index + 1;
    const raw = pageText.split('\n');
    const first = raw.findIndex((line) => line.trim() !== '');
    if (first === -1 || raw[first].trim() !== String(page)) {
      throw new Error(`page ${page} does not start with its page number`);
    }
    raw.forEach((line, at) => {
      if (at !== first) lines.push({ raw: line.replace(/\s+$/u, ''), page });
    });
  });
  return lines;
}

const indent = (line: string): number => line.length - line.trimStart().length;

const PARAGRAPH_INDENT = 3;

/** Joins two wrapped lines: a hyphen glued to a letter keeps the hyphen and drops the space; else one space. */
export function joinWrapped(left: string, right: string): string {
  return /\p{L}-$/u.test(left) && /^\p{L}/u.test(right) ? `${left}${right}` : `${left} ${right}`;
}

/** Applies the overrides in order, turning each matched run of lines into a block. */
function applyOverrides(lines: Line[], overrides: RegulationOverride[]): (Line | Unit)[] {
  let items: (Line | Unit)[] = lines;
  for (const override of overrides) {
    const { start, end } = onlyMatch(items, override);
    const matchedLines = items.slice(start, end) as Line[];
    const pages = [...new Set(matchedLines.filter((line) => line.raw.trim() !== '').map((line) => line.page))];
    const replacement: (Line | Unit)[] =
      override.replacement.length === 0 ? [] : [{ kind: 'block', text: override.replacement.join('\n'), pages }];
    items = [...items.slice(0, start), ...replacement, ...items.slice(end)];
  }
  return items;
}

function onlyMatch(items: (Line | Unit)[], override: RegulationOverride): { start: number; end: number } {
  const want = override.source.map(collapse);
  const matches: { start: number; end: number }[] = [];
  for (let start = 0; start < items.length; start++) {
    const first = items[start];
    if (!('raw' in first) || first.page !== override.page || collapse(first.raw) !== want[0]) continue;
    const end = matchEnd(items, start, want);
    if (end !== null) matches.push({ start, end });
  }
  if (matches.length !== 1) {
    throw new Error(`override on page ${override.page} ("${want[0]}") matches ${matches.length} places, not 1`);
  }
  return matches[0];
}

function matchEnd(items: (Line | Unit)[], start: number, want: string[]): number | null {
  let at = start;
  let matched = 0;
  while (at < items.length && matched < want.length) {
    const item = items[at];
    if (!('raw' in item)) break;
    if (item.raw.trim() === '') {
      at++;
      continue;
    }
    if (collapse(item.raw) !== want[matched]) break;
    matched++;
    at++;
  }
  return matched === want.length ? at : null;
}

/**
 * Reflows lines into paragraphs. A line starts a paragraph when it is indented at least three columns
 * deeper than the least indented line of its page; otherwise it continues the paragraph before it.
 */
function paragraphs(items: (Line | Unit)[]): Unit[] {
  const baseline = new Map<number, number>();
  for (const item of items) {
    if ('raw' in item && item.raw.trim() !== '') {
      baseline.set(item.page, Math.min(baseline.get(item.page) ?? Infinity, indent(item.raw)));
    }
  }
  const units: Unit[] = [];
  let open: Unit | null = null;
  for (const item of items) {
    if (!('raw' in item)) {
      units.push(item);
      open = null;
      continue;
    }
    const text = collapse(item.raw);
    if (text === '') continue;
    if (open && indent(item.raw) < (baseline.get(item.page) ?? 0) + PARAGRAPH_INDENT) {
      open.text = joinWrapped(open.text, text);
      if (!open.pages.includes(item.page)) open.pages.push(item.page);
    } else {
      open = { kind: 'paragraph', text, pages: [item.page] };
      units.push(open);
    }
  }
  return units;
}

const CHAPTER = /^Chương ([IVXLC]+)$/u;
const ARTICLE = /^Điều (\d+)\.\s*(.*)$/u;
const KHOAN = /^(\d+)\.\s/u;
const DIEM = /^([a-zđ])\)\s/u;
const CLOSING = /^\s*Nơi nhận:/u;
const ORDINALS = ['', '', 'thứ hai', 'thứ ba', 'thứ tư'];
const ENGLISH_ORDINALS = ['', 'first', 'second', 'third', 'fourth'];
const LETTERS = 'abcdđefghijklmnopqrstuvwxyz';

/** The letter after `previous` in a list of điểm: `đ` may follow `d` or be skipped. */
const nextLetters = (previous: string | null): string[] => {
  if (previous === null) return ['a'];
  if (previous === 'd') return ['đ', 'e'];
  return [LETTERS[LETTERS.indexOf(previous) + 1]];
};

const idLetter = (letter: string): string => (letter === 'đ' ? 'dd' : letter);
const repeat = (occurrence: number): string => (occurrence > 1 ? `-${occurrence}` : '');
const repeatLabel = (occurrence: number): string => {
  if (occurrence >= ORDINALS.length) throw new Error(`a number repeated ${occurrence} times needs an override`);
  return occurrence > 1 ? ` (${ORDINALS[occurrence]})` : '';
};

interface KhoanMark {
  number: number;
  occurrence: number;
  id: string;
  label: string;
}

class ClauseBuilder {
  readonly clauses: Clause[] = [];
  private chapter: Clause['chapter'] | null = null;
  private article: Clause['article'] | null = null;
  private current: Clause | null = null;
  private lastKhoan: KhoanMark | null = null;
  private lastDiem: string | null = null;
  private seenKhoan = new Map<number, number>();
  private seenDiem = new Map<string, number>();
  private lastArticle = 0;
  private expectArticleTitle = false;
  private expectChapterTitle = false;

  constructor(private readonly documentId: string) {}

  add(unit: Unit): void {
    if (unit.kind === 'paragraph' && this.heading(unit)) return;
    this.expectArticleTitle = false;
    this.expectChapterTitle = false;
    this.append(unit);
  }

  private heading(unit: Unit): boolean {
    return this.chapterHeading(unit.text) || this.chapterTitle(unit.text) || this.articleHeading(unit.text) || this.articleTitle(unit.text) || this.khoan(unit) || this.diem(unit);
  }

  private chapterHeading(text: string): boolean {
    const match = CHAPTER.exec(text);
    if (!match) return false;
    this.chapter = { number: match[1], title: '' };
    this.article = null;
    this.current = null;
    this.expectChapterTitle = true;
    return true;
  }

  private chapterTitle(text: string): boolean {
    if (this.expectChapterTitle && this.chapter && text === text.toUpperCase() && /\p{Lu}/u.test(text)) {
      this.chapter.title = this.chapter.title ? `${this.chapter.title} ${text}` : text;
      return true;
    }
    this.expectChapterTitle = false;
    return false;
  }

  private articleHeading(text: string): boolean {
    const match = ARTICLE.exec(text);
    if (!match) return false;
    const number = Number(match[1]);
    if (number !== this.lastArticle + 1) throw new Error(`Điều ${number} follows Điều ${this.lastArticle}`);
    if (!this.chapter?.title) throw new Error(`Điều ${number} has no chapter title before it`);
    this.lastArticle = number;
    this.article = { number, title: match[2] };
    this.current = null;
    this.lastKhoan = null;
    this.lastDiem = null;
    this.seenKhoan = new Map();
    this.expectArticleTitle = true;
    return true;
  }

  private articleTitle(text: string): boolean {
    if (this.expectArticleTitle && this.article && /^\p{Ll}/u.test(text)) {
      this.article.title = `${this.article.title} ${text}`;
      return true;
    }
    this.expectArticleTitle = false;
    return false;
  }

  private khoan(unit: Unit): boolean {
    const article = this.article;
    const match = article ? KHOAN.exec(unit.text) : null;
    if (!match || !article) return false;
    const number = Number(match[1]);
    const occurrence = (this.seenKhoan.get(number) ?? 0) + 1;
    const expected = (this.lastKhoan?.number ?? 0) + 1;
    if (occurrence === 1 && number !== expected) throw new Error(`Điều ${article.number}: khoản ${number} follows khoản ${expected - 1}`);
    if (occurrence > 1 && number !== this.lastKhoan?.number) throw new Error(`Điều ${article.number}: khoản ${number} repeats out of order`);
    this.seenKhoan.set(number, occurrence);
    const id = `${this.documentId}/d${article.number}/k${number}${repeat(occurrence)}`;
    const label = `Điều ${article.number}, khoản ${number}${repeatLabel(occurrence)}`;
    this.lastKhoan = { number, occurrence, id, label };
    this.lastDiem = null;
    this.seenDiem = new Map();
    const note = `The source numbers more than one khoản of Điều ${article.number} as ${number}; this is the ${ENGLISH_ORDINALS[occurrence]}.`;
    this.open({ id, label, level: 'khoan', khoan: number, diem: null, ...(occurrence > 1 ? { note } : {}) }, unit);
    return true;
  }

  private diem(unit: Unit): boolean {
    const khoan = this.lastKhoan;
    const match = khoan ? DIEM.exec(unit.text) : null;
    if (!match || !khoan || !this.article) return false;
    const letter = match[1];
    const occurrence = (this.seenDiem.get(letter) ?? 0) + 1;
    if (occurrence === 1 && !nextLetters(this.lastDiem).includes(letter)) {
      throw new Error(`${khoan.label}: điểm ${letter} follows điểm ${this.lastDiem ?? '(none)'}`);
    }
    this.seenDiem.set(letter, occurrence);
    this.lastDiem = occurrence === 1 ? letter : this.lastDiem;
    const note = `The source letters more than one điểm of ${khoan.label} as ${letter}; this is the ${ENGLISH_ORDINALS[occurrence]}.`;
    this.open(
      {
        id: `${khoan.id}/${idLetter(letter)}${repeat(occurrence)}`,
        label: `${khoan.label}, điểm ${letter}${repeatLabel(occurrence)}`,
        level: 'diem',
        khoan: khoan.number,
        diem: letter,
        ...(occurrence > 1 ? { note } : {}),
      },
      unit,
    );
    return true;
  }

  private open(clause: Omit<Clause, 'chapter' | 'article' | 'pages' | 'text'>, unit: Unit): void {
    if (!this.chapter || !this.article) throw new Error(`"${unit.text.slice(0, 40)}" comes before any Điều`);
    this.current = { ...clause, chapter: this.chapter, article: this.article, pages: [...unit.pages], text: unit.text };
    this.clauses.push(this.current);
  }

  private append(unit: Unit): void {
    if (!this.current) {
      if (!this.chapter || !this.article) throw new Error(`"${unit.text.slice(0, 40)}" comes before any Điều`);
      // Text right under a Điều heading, before its first khoản.
      const id = `${this.documentId}/d${this.article.number}`;
      this.current = { id, label: `Điều ${this.article.number}`, level: 'article', chapter: this.chapter, article: this.article, khoan: null, diem: null, pages: [], text: '' };
      this.clauses.push(this.current);
    }
    const clause = this.current;
    clause.text = clause.text === '' ? unit.text : `${clause.text}\n${unit.text}`;
    for (const page of unit.pages) if (!clause.pages.includes(page)) clause.pages.push(page);
  }
}

/** Builds the clause list. Throws on any numbering it cannot explain, so a new document fails loudly. */
export function extractRegulation(source: RegulationSource, pdftotext: string, overrides: RegulationOverride[]): RegulationDocument {
  const lines = pageLines(pdftotext);
  if (lines.at(-1)?.page !== source.pdf.pages) {
    throw new Error(`the text has ${lines.at(-1)?.page} pages, the PDF ${source.pdf.pages}`);
  }
  const closingAt = lines.findIndex((line) => CLOSING.test(line.raw));
  const body = closingAt === -1 ? lines : lines.slice(0, closingAt);
  const closing = closingAt === -1 ? '' : lines.slice(closingAt).map((line) => collapse(line.raw)).filter(Boolean).join('\n');
  const units = paragraphs(applyOverrides(body, overrides));

  const firstChapter = units.findIndex((unit) => unit.kind === 'paragraph' && CHAPTER.test(unit.text));
  if (firstChapter === -1) throw new Error('no "Chương I" heading');
  const preamble = units.slice(0, firstChapter).map((unit) => unit.text).join('\n');

  const builder = new ClauseBuilder(source.id);
  for (const unit of units.slice(firstChapter)) builder.add(unit);
  return { ...source, preamble, clauses: builder.clauses, closing };
}

const LABEL =
  /^Điều (\d+)(?:, khoản (\d+)(?: \((thứ hai|thứ ba|thứ tư)\))?(?:, điểm ([a-zđ])(?: \((thứ hai|thứ ba|thứ tư)\))?)?)?$/u;

export interface ParsedLabel {
  article: number;
  khoan: number | null;
  khoanOccurrence: number;
  diem: string | null;
  diemOccurrence: number;
}

/** Parses a clause label, or returns null when it is not one. */
export function parseLabel(label: string): ParsedLabel | null {
  const match = LABEL.exec(label);
  if (!match) return null;
  return {
    article: Number(match[1]),
    khoan: match[2] === undefined ? null : Number(match[2]),
    khoanOccurrence: match[3] ? ORDINALS.indexOf(match[3]) : 1,
    diem: match[4] ?? null,
    diemOccurrence: match[5] ? ORDINALS.indexOf(match[5]) : 1,
  };
}

/** The clause id a label names inside `documentId`. */
export function idFromLabel(documentId: string, label: ParsedLabel): string {
  let id = `${documentId}/d${label.article}`;
  if (label.khoan !== null) id += `/k${label.khoan}${repeat(label.khoanOccurrence)}`;
  if (label.diem !== null) id += `/${idLetter(label.diem)}${repeat(label.diemOccurrence)}`;
  return id;
}

/** The document's text in source order: preamble, headings, clause texts, closing. */
export function renderPlainText(document: RegulationDocument): string {
  const out = [
    document.preamble,
    ...walkClauses(document.clauses, {
      chapter: ({ chapter }) => [`Chương ${chapter.number}`, chapter.title],
      article: ({ article }) => [`Điều ${article.number}. ${article.title}`],
      clause: (clause) => [clause.text],
    }),
    document.closing,
  ];
  return `${out.join('\n')}\n`;
}

interface ClauseRendering {
  chapter: (clause: Clause) => string[];
  article: (clause: Clause) => string[];
  clause: (clause: Clause) => string[];
}

function walkClauses(clauses: Clause[], render: ClauseRendering): string[] {
  const out: string[] = [];
  let chapter = '';
  let article = 0;
  for (const clause of clauses) {
    if (clause.chapter.number !== chapter) {
      chapter = clause.chapter.number;
      out.push(...render.chapter(clause));
    }
    if (clause.article.number !== article) {
      article = clause.article.number;
      out.push(...render.article(clause));
    }
    out.push(...render.clause(clause));
  }
  return out;
}

const isTableRow = (line: string): boolean => line.startsWith('|');
const isTableRule = (line: string): boolean => /^\|(?:\s*:?-+:?\s*\|)+$/u.test(line);

/** Words in order: Markdown table pipes and rule rows are layout, not words. */
export function words(text: string): string[] {
  return text
    .split('\n')
    .filter((line) => !isTableRule(line.trim()))
    .map((line) => (isTableRow(line.trim()) ? line.replace(/\|/gu, ' ') : line))
    .join(' ')
    .normalize('NFC')
    .split(/\s+/u)
    .filter(Boolean);
}

/** The words of the source body: every line except the page numbers. */
export const sourceWords = (pdftotext: string): string[] =>
  words(pageLines(pdftotext).map((line) => line.raw).join('\n'));

export interface Hunk {
  /** Index of the first changed word in the left sequence. */
  at: number;
  removed: string[];
  added: string[];
}

const MAX_DIFF_EDITS = 2000;

interface Edit {
  op: 'del' | 'ins';
  x: number;
  y: number;
}

/**
 * Myers' O(ND) diff of two word sequences, as hunks of removed and added words.
 * Throws when more than `maxEdits` words differ: the trace would not fit in memory, and no real residue is that big.
 */
export function diffWords(left: string[], right: string[], maxEdits = MAX_DIFF_EDITS): Hunk[] {
  return hunksOf(editsOf(left, right, myersTrace(left, right, maxEdits)), left, right);
}

function myersTrace(left: string[], right: string[], maxEdits: number): { trace: Int32Array[]; offset: number } {
  const max = Math.min(left.length + right.length, maxEdits);
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < left.length && y < right.length && left[x] === right[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= left.length && y >= right.length) return { trace, offset };
    }
  }
  throw new Error(`the word sequences differ by more than ${maxEdits} edits`);
}

function editsOf(left: string[], right: string[], { trace, offset }: { trace: Int32Array[]; offset: number }): Edit[] {
  // Walk back through the trace to list the edits.
  const edits: Edit[] = [];
  let x = left.length;
  let y = right.length;
  for (let d = trace.length - 1; d > 0; d--) {
    const vd = trace[d];
    const k = x - y;
    const down = k === -d || (k !== d && vd[offset + k - 1] < vd[offset + k + 1]);
    const prevK = down ? k + 1 : k - 1;
    const prevX = vd[offset + prevK];
    const prevY = prevX - prevK;
    edits.push({ op: down ? 'ins' : 'del', x: prevX, y: prevY });
    x = prevX;
    y = prevY;
  }
  return edits.reverse();
}

function hunksOf(edits: Edit[], left: string[], right: string[]): Hunk[] {
  const hunks: Hunk[] = [];
  let hunk: Hunk | null = null;
  let lastX = -1;
  let lastY = -1;
  for (const edit of edits) {
    if (!hunk || edit.x !== lastX || edit.y !== lastY) {
      hunk = { at: edit.x, removed: [], added: [] };
      hunks.push(hunk);
    }
    if (edit.op === 'del') {
      hunk.removed.push(left[edit.x]);
      lastX = edit.x + 1;
      lastY = edit.y;
    } else {
      hunk.added.push(right[edit.y]);
      lastX = edit.x;
      lastY = edit.y + 1;
    }
  }
  return hunks;
}

const escapeMarkdown = (line: string): string =>
  line
    .replace(/([\\*_`])/gu, '\\$1')
    .replace(/^(\d+)\. /u, '$1\\. ')
    .replace(/^([#>+])/u, '\\$1');

/** Paragraphs separated by blank lines; table rows kept together; `$$` formulas left alone. */
function markdownText(text: string): string {
  const out: string[] = [];
  let inTable = false;
  for (const line of text.split('\n')) {
    const table = isTableRow(line);
    if (table && inTable) out[out.length - 1] += `\n${line}`;
    else out.push(table || line.startsWith('$$') ? line : escapeMarkdown(line));
    inTable = table;
  }
  return out.join('\n\n');
}

/** The human-readable version of a document; generated, so it never drifts from the JSON. */
export function renderMarkdown(document: RegulationDocument): string {
  const out: string[] = [
    `# ${document.title} (${document.shortName})`,
    `<!-- Generated from ${document.id}.json by extract-regulation. Do not edit by hand. -->`,
    [
      `- Decision: ${document.decision.text}`,
      `- Issuer: ${document.issuer}`,
      `- Date: ${document.decision.date}`,
      `- Source: <${document.sourceUrl}>`,
      `- PDF: ${document.pdf.pages} pages, sha256 \`${document.pdf.sha256}\``,
      `- Clauses: ${document.clauses.length}`,
      ...document.notes.map((note) => `- Note: ${note}`),
    ].join('\n'),
    markdownText(document.preamble),
    ...walkClauses(document.clauses, {
      chapter: ({ chapter }) => [`## Chương ${chapter.number}. ${chapter.title}`],
      article: ({ article }) => [`### Điều ${article.number}. ${article.title}`],
      clause: (clause) => [`<!-- ${clause.id} · ${clause.label} · tr. ${clause.pages.join(', ')} -->`, markdownText(clause.text)],
    }),
  ];
  if (document.closing) out.push('---', document.closing.split('\n').map(escapeMarkdown).join('  \n'));
  return `${out.join('\n\n')}\n`;
}
