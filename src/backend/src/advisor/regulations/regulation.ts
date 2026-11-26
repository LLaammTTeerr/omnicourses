export interface RegulationSource {
  id: string;
  title: string;
  shortName: string;
  decision: { number: string; date: string; text: string };
  issuer: string;
  sourceUrl: string;
  pdf: { sha256: string; pages: number };
  textLayer: { command: string; tool: string; sha256: string };
  notes: string[];
}

export interface RegulationOverride {
  kind: 'layout' | 'text';
  page: number;
  reason: string;
  source: string[];
  replacement: string[];
}

export interface Clause {
  id: string;
  label: string;
  level: 'article' | 'khoan' | 'diem';
  chapter: { number: string; title: string };
  article: { number: number; title: string };
  khoan: number | null;
  diem: string | null;
  pages: number[];
  text: string;
  note?: string;
}

export interface RegulationDocument extends RegulationSource {
  preamble: string;
  clauses: Clause[];
  closing: string;
}

interface Line {
  raw: string;
  page: number;
}

interface Unit {
  kind: 'paragraph' | 'block';
  text: string;
  pages: number[];
}

const collapse = (text: string): string => text.normalize('NFC').replace(/\s+/gu, ' ').trim();

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

export function joinWrapped(left: string, right: string): string {
  return /\p{L}-$/u.test(left) && /^\p{L}/u.test(right) ? `${left}${right}` : `${left} ${right}`;
}

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
      const id = `${this.documentId}/d${this.article.number}`;
      this.current = { id, label: `Điều ${this.article.number}`, level: 'article', chapter: this.chapter, article: this.article, khoan: null, diem: null, pages: [], text: '' };
      this.clauses.push(this.current);
    }
    const clause = this.current;
    clause.text = clause.text === '' ? unit.text : `${clause.text}\n${unit.text}`;
    for (const page of unit.pages) if (!clause.pages.includes(page)) clause.pages.push(page);
  }
}

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

export function idFromLabel(documentId: string, label: ParsedLabel): string {
  let id = `${documentId}/d${label.article}`;
  if (label.khoan !== null) id += `/k${label.khoan}${repeat(label.khoanOccurrence)}`;
  if (label.diem !== null) id += `/${idLetter(label.diem)}${repeat(label.diemOccurrence)}`;
  return id;
}

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

export const sourceWords = (pdftotext: string): string[] =>
  words(pageLines(pdftotext).map((line) => line.raw).join('\n'));

export interface Hunk {
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
